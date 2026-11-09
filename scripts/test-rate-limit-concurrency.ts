import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())

import { prisma } from "../src/lib/prisma"
import { checkDistributedRateLimit, clearDistributedRateLimit } from "../src/lib/services/rate-limit.service"

async function runConcurrencyTest() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Rate Limiting Concurrency & Atomicity Test     ")
  console.log("=================================================================\n")

  const testKey = `concurrency_audit_${Date.now()}`
  const MAX_ATTEMPTS = 5
  const TOTAL_CONCURRENT = 20
  const WINDOW_SECONDS = 60

  let passed = 0
  let failed = 0

  function assert(condition: boolean, msg: string, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${msg}`)
      if (details) console.error(`    ↳ Details: ${details}`)
      failed++
    }
  }

  try {
    console.log(`[1/3] Preparing test key: ${testKey}`)
    await clearDistributedRateLimit(testKey)

    console.log(`[2/3] Firing ${TOTAL_CONCURRENT} simultaneous requests for limit = ${MAX_ATTEMPTS}...`)
    const startTime = Date.now()

    // Send TOTAL_CONCURRENT requests simultaneously to provoke race conditions
    const results = await Promise.all(
      Array.from({ length: TOTAL_CONCURRENT }, () =>
        checkDistributedRateLimit(testKey, MAX_ATTEMPTS, WINDOW_SECONDS)
      )
    )

    const duration = Date.now() - startTime
    console.log(`      Completed ${TOTAL_CONCURRENT} requests in ${duration}ms\n`)

    const successCount = results.filter((r) => r.success).length
    const rejectedCount = results.filter((r) => !r.success).length

    console.log(`[3/3] Analyzing concurrency results:`)
    console.log(`      Accepted: ${successCount} / ${TOTAL_CONCURRENT}`)
    console.log(`      Rejected: ${rejectedCount} / ${TOTAL_CONCURRENT}`)

    assert(
      successCount <= MAX_ATTEMPTS,
      `Accepted request count (${successCount}) never exceeds max limit (${MAX_ATTEMPTS})`,
      `Expected <= ${MAX_ATTEMPTS}, got ${successCount}`
    )

    assert(
      successCount === MAX_ATTEMPTS,
      `Exactly ${MAX_ATTEMPTS} requests accepted`,
      `Expected ${MAX_ATTEMPTS}, got ${successCount}`
    )

    assert(
      rejectedCount === TOTAL_CONCURRENT - MAX_ATTEMPTS,
      `Exactly ${TOTAL_CONCURRENT - MAX_ATTEMPTS} requests throttled`,
      `Expected ${TOTAL_CONCURRENT - MAX_ATTEMPTS}, got ${rejectedCount}`
    )

    // Verify database count
    const dbTokens = await prisma.verificationToken.count({
      where: { identifier: `rl:${testKey}` },
    })
    assert(
      dbTokens === MAX_ATTEMPTS,
      `Database records match accepted count: ${dbTokens} in Neon PostgreSQL`,
      `Expected ${MAX_ATTEMPTS}, got ${dbTokens}`
    )

    // Verify resetInSeconds on rejected requests
    const rejectedResults = results.filter((r) => !r.success)
    const validResetTimers = rejectedResults.every(
      (r) => r.resetInSeconds > 0 && r.resetInSeconds <= WINDOW_SECONDS
    )
    assert(validResetTimers, `All throttled responses contain accurate resetInSeconds (1..${WINDOW_SECONDS}s)`)
  } finally {
    // Teardown
    await clearDistributedRateLimit(testKey)
    console.log("\n  ✓ Teardown: Cleaned up concurrency audit records.")
  }

  console.log("\n=================================================================")
  console.log(`  RATE LIMIT CONCURRENCY RESULTS: ${passed} PASSED / ${failed} FAILED`)
  console.log("=================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

runConcurrencyTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL: Concurrency test failed with exception:", err)
    process.exit(1)
  })
