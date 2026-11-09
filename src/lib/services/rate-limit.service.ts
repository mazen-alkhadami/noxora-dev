import { prisma } from "@/lib/prisma"
import crypto from "crypto"

/**
 * Hybrid token-bucket and persistent rate limiter for sensitive authentication actions.
 * Protects against brute-force attacks across single-instance and multi-instance
 * serverless deployments (Vercel / multiple containers).
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitRecord>()

// Clean up expired in-memory entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of store.entries()) {
      if (record.resetTime <= now) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)

  // Unref timer so it doesn't block node process exit in tests or build scripts
  if (cleanupTimer.unref) {
    cleanupTimer.unref()
  }
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Fast in-memory rate limiter check.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowSeconds: number = 60
): RateLimitResult {
  const now = Date.now()
  const record = store.get(key)

  if (!record || record.resetTime <= now) {
    store.set(key, {
      count: 1,
      resetTime: now + windowSeconds * 1000,
    })
    return {
      success: true,
      remaining: maxAttempts - 1,
      resetInSeconds: windowSeconds,
    }
  }

  if (record.count >= maxAttempts) {
    const resetInSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000))
    return {
      success: false,
      remaining: 0,
      resetInSeconds,
    }
  }

  record.count += 1
  const resetInSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000))
  return {
    success: true,
    remaining: maxAttempts - record.count,
    resetInSeconds,
  }
}

/**
 * Helper to execute an async operation with bounded retries for transient
 * PostgreSQL serialization conflicts, deadlocks, or pool acquisition timeouts.
 */
async function executeWithBoundedRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await operation()
    } catch (err: unknown) {
      attempt++
      const message = err instanceof Error ? err.message : String(err)
      const isRetryable =
        message.includes("40001") || // PostgreSQL serialization_failure
        message.includes("could not serialize access") ||
        message.includes("deadlock detected") ||
        message.includes("write conflict") ||
        message.includes("Unable to start a transaction") ||
        message.includes("P2034") || // Prisma transaction conflict
        message.includes("P2028") // Prisma transaction timeout

      if (attempt >= maxRetries || !isRetryable) {
        throw err
      }

      // Jittered backoff: 30ms to 80ms
      const delayMs = attempt * 30 + Math.floor(Math.random() * 30)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/**
 * Distributed persistent rate limiter backed by Neon PostgreSQL.
 * Operates across multiple serverless instances, cold starts, and worker processes.
 *
 * Concurrency & Atomicity Guarantee:
 * Uses transaction-scoped PostgreSQL advisory locks (`pg_advisory_xact_lock(hashtext(identifier))`)
 * with bounded retries (max 3). This guarantees that simultaneous concurrent requests for the exact
 * same rate-limit key are strictly serialized in the database and can never exceed the configured
 * maxAttempts threshold.
 *
 * Fallback Behavior on Neon Unavailability:
 * If the database connection is interrupted or Neon is unreachable, the system falls back
 * to the local in-memory tier (`memResult`).
 * IMPORTANT: In-memory fallback provides LOCAL container protection only; it does NOT provide
 * distributed multi-instance protection. It functions strictly as a resilience fail-safe to
 * prevent complete service denial to legitimate users during database partitions.
 */
export async function checkDistributedRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  // 1. In-memory fast tier check (protects against single-instance spam with 0ms latency)
  const memResult = checkRateLimit(key, maxAttempts, windowSeconds)
  if (!memResult.success) {
    return memResult
  }

  // 2. Database distributed tier check with advisory locking & bounded retries
  try {
    const identifier = `rl:${key}`

    const result = await executeWithBoundedRetry(async () => {
      return await prisma.$transaction(
        async (tx) => {
          // Serialize concurrent requests for this specific rate-limit key
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identifier}))`

          const now = new Date()

          // Clean up expired records for this specific key
          await tx.verificationToken.deleteMany({
            where: {
              identifier,
              expires: { lte: now },
            },
          })

          // Count active attempts within the window
          const activeAttempts = await tx.verificationToken.count({
            where: {
              identifier,
              expires: { gt: now },
            },
          })

          if (activeAttempts >= maxAttempts) {
            // Calculate true remaining time based on the earliest expiring token
            const earliest = await tx.verificationToken.findFirst({
              where: { identifier, expires: { gt: now } },
              orderBy: { expires: "asc" },
              select: { expires: true },
            })
            const resetInSeconds = earliest
              ? Math.max(1, Math.ceil((earliest.expires.getTime() - now.getTime()) / 1000))
              : windowSeconds

            return {
              success: false,
              remaining: 0,
              resetInSeconds,
            }
          }

          // Record this attempt atomically
          const expires = new Date(now.getTime() + windowSeconds * 1000)
          await tx.verificationToken.create({
            data: {
              identifier,
              token: `rl_${crypto.randomUUID()}`,
              expires,
            },
          })

          return {
            success: true,
            remaining: Math.max(0, maxAttempts - activeAttempts - 1),
            resetInSeconds: windowSeconds,
          }
        },
        {
          maxWait: 15000,
          timeout: 15000,
        }
      )
    })

    // Opportunistically prune other expired records in background
    prisma.verificationToken
      .deleteMany({
        where: {
          identifier: { startsWith: "rl:" },
          expires: { lt: new Date() },
        },
      })
      .catch(() => {})

    return result
  } catch (error) {
    // Database Unavailability Behavior:
    // If the database is unreachable (e.g. network partition or cold start blip),
    // we gracefully fall back to the in-memory tier result (`memResult`).
    // Note: This fallback is local-only to this container process and does NOT offer distributed protection.
    console.warn(
      "[RateLimit] Database tier unavailable, falling back to local-only in-memory tier:",
      error instanceof Error ? error.message : error
    )
    return memResult
  }
}

/**
 * Resets the in-memory rate limit.
 */
export function clearRateLimit(key: string): void {
  store.delete(key)
}

/**
 * Resets both in-memory and distributed database rate limits for a key.
 */
export async function clearDistributedRateLimit(key: string): Promise<void> {
  store.delete(key)
  try {
    await prisma.verificationToken.deleteMany({
      where: { identifier: `rl:${key}` },
    })
  } catch {
    // Graceful no-op on database cleanup error
  }
}
