import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const DEMO_USER_ID = "usr_demo_nexora_dev"
export const DEMO_USER_EMAIL = "alex.rivera@nexora.dev"

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
}

export async function resolveCurrentUser(): Promise<AuthenticatedUser> {
  // 1. Resolve from real NextAuth session if available
  try {
    const session = await auth()
    if (session?.user?.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, name: true, sessionVersion: true },
      })

      if (!dbUser) {
        throw new Error("UNAUTHORIZED: User account not found.")
      }

      // Check session validity against password updates (session revocation strategy)
      const jwtSessionVersion = (session.user as unknown as { sessionVersion?: number })?.sessionVersion
      if (typeof jwtSessionVersion === "number") {
        if (dbUser.sessionVersion !== jwtSessionVersion) {
          throw new Error(
            "UNAUTHORIZED: Session invalidated due to security update. Please sign in again."
          )
        }
      }

      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name || "User",
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED")) {
      throw err
    }
    // In standalone script / non-request context, auth() might throw or return null
  }

  // 2. Allow test override for automated test harnesses running outside HTTP context
  if (process.env.TEST_AUTH_USER_ID) {
    const testUser = await prisma.user.findUnique({
      where: { id: process.env.TEST_AUTH_USER_ID },
      select: { id: true, email: true, name: true },
    })
    if (testUser) {
      return {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name || "Test User",
      }
    }
  }

  // 3. Fallback to Demo User ONLY in development/test when explicitly allowed (STRICTLY FORBIDDEN IN PRODUCTION)
  if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_FALLBACK === "true") {
    const demoUser = await prisma.user.findUnique({
      where: { id: DEMO_USER_ID },
      select: { id: true, email: true, name: true },
    })
    if (demoUser) {
      return {
        id: demoUser.id,
        email: demoUser.email,
        name: demoUser.name || "Alex Rivera",
      }
    }
  }

  // 4. Default: UNAUTHORIZED when no valid session is active
  throw new Error("UNAUTHORIZED: Authentication is required to perform this action.")
}
