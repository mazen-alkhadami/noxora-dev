import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())

import { prisma } from "../src/lib/prisma"
import { registerUserAction, resetPasswordAction } from "../src/actions/auth.actions"
import { registerSchema } from "../src/lib/validations/auth.schema"
import { resolveCurrentUser, DEMO_USER_ID } from "../src/lib/auth-context"
import { getProjectsAction, createProjectAction, deleteProjectAction } from "../src/actions/project.actions"
import { getTasksAction, createTaskAction } from "../src/actions/task.actions"
import bcrypt from "bcryptjs"
import crypto from "crypto"

async function runPhase5AuthVerification() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Phase 5: Authentication & Multi-User Verification")
  console.log("=================================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition: boolean, label: string, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${label}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${label}`)
      if (details) console.error(`    ↳ Details: ${details}`)
      failed++
    }
  }

  const TEST_USER_A = {
    name: "Elena Rostova",
    email: `test_elena_${Date.now()}@nexora.dev`,
    password: "SecurePassword123!",
  }

  const TEST_USER_B = {
    name: "Marcus Vance",
    email: `test_marcus_${Date.now()}@nexora.dev`,
    password: "AnotherPassword456!",
  }

  let userAId = ""
  let userBId = ""

  try {
    // ── SECTION 1: Zod Auth Validation ──
    console.log("── 1. Zod Auth Validation Schemas ──")

    const invalidEmailRes = registerSchema.safeParse({
      name: "Test",
      email: "not-an-email",
      password: "Password123",
      confirmPassword: "Password123",
    })
    assert(!invalidEmailRes.success, "Rejects invalid email format")

    const shortPasswordRes = registerSchema.safeParse({
      name: "Test",
      email: "valid@example.com",
      password: "pass",
      confirmPassword: "pass",
    })
    assert(!shortPasswordRes.success, "Rejects password shorter than 8 characters")

    const noNumPasswordRes = registerSchema.safeParse({
      name: "Test",
      email: "valid@example.com",
      password: "passwordwithoutnumber",
      confirmPassword: "passwordwithoutnumber",
    })
    assert(!noNumPasswordRes.success, "Rejects password without a number")

    const mismatchPasswordRes = registerSchema.safeParse({
      name: "Test",
      email: "valid@example.com",
      password: "Password123",
      confirmPassword: "DifferentPassword123",
    })
    assert(!mismatchPasswordRes.success, "Rejects mismatched password confirmation")

    const validRegisterRes = registerSchema.safeParse({
      name: TEST_USER_A.name,
      email: TEST_USER_A.email,
      password: TEST_USER_A.password,
      confirmPassword: TEST_USER_A.password,
    })
    assert(validRegisterRes.success, "Accepts valid registration payload")

    // ── SECTION 2: User Registration & Password Hashing ──
    console.log("\n── 2. User Registration & Hashing ──")

    const regResultA = await registerUserAction({
      name: TEST_USER_A.name,
      email: TEST_USER_A.email,
      password: TEST_USER_A.password,
      confirmPassword: TEST_USER_A.password,
    })

    assert(regResultA.success, "Successfully registers new user A via Server Action")
    if (regResultA.success) {
      userAId = regResultA.data.id
      assert(!!userAId, "User ID is generated as CUID")
      assert(regResultA.data.email === TEST_USER_A.email.toLowerCase(), "Email is normalized and returned")
    }

    // Inspect database record directly in Neon PostgreSQL
    const dbUserA = await prisma.user.findUnique({
      where: { id: userAId },
      include: { preferences: true, projects: true, tasks: true },
    })

    assert(!!dbUserA, "User A record exists in Neon PostgreSQL")
    assert(!!dbUserA?.password && dbUserA.password.startsWith("$2"), "Password is saved as bcrypt hash ($2...)")
    assert(dbUserA?.initials === "ER", `Initials correctly computed: expected 'ER', got '${dbUserA?.initials}'`)
    assert(!!dbUserA?.preferences, "Default UserPreferences record automatically provisioned")
    assert(dbUserA?.preferences?.defaultView === "dashboard", "Default preferences view is 'dashboard'")
    assert(dbUserA?.preferences?.confirmBeforeDelete === true, "confirmBeforeDelete default is true")
    assert(dbUserA?.projects.length === 0, "User A workspace starts with 0 projects (isolated empty workspace)")
    assert(dbUserA?.tasks.length === 0, "User A workspace starts with 0 tasks (isolated empty workspace)")

    // Verify bcrypt password verification against stored hash
    const isPasswordValid = await bcrypt.compare(TEST_USER_A.password, dbUserA!.password!)
    assert(isPasswordValid, "bcrypt.compare validates raw password against stored hash")

    const isWrongPasswordInvalid = !(await bcrypt.compare("WrongPassword999!", dbUserA!.password!))
    assert(isWrongPasswordInvalid, "bcrypt.compare rejects incorrect password")

    // Verify sessionVersion mechanism
    assert(dbUserA?.sessionVersion === 0, "User sessionVersion initializes to 0")

    // Test session revocation: reset password atomically increments sessionVersion
    const testResetToken = `test_rst_${crypto.randomBytes(16).toString("hex")}`
    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${TEST_USER_A.email.toLowerCase()}`,
        token: testResetToken,
        expires: new Date(Date.now() + 3600 * 1000),
      },
    })
    const resetResult = await resetPasswordAction({
      token: testResetToken,
      password: "BrandNewPassword999!",
      confirmPassword: "BrandNewPassword999!",
    })
    assert(resetResult.success, "Password reset action executes successfully")

    const userAAfterReset = await prisma.user.findUnique({
      where: { id: userAId },
      select: { sessionVersion: true },
    })
    assert(
      userAAfterReset?.sessionVersion === 1,
      `sessionVersion atomically incremented: expected 1, got ${userAAfterReset?.sessionVersion}`
    )

    // ── SECTION 3: Duplicate Email Protection & Anti-Enumeration ──
    console.log("\n── 3. Duplicate Email Protection ──")

    const duplicateReg = await registerUserAction({
      name: "Duplicate User",
      email: TEST_USER_A.email,
      password: "Password123!",
      confirmPassword: "Password123!",
    })

    assert(!duplicateReg.success, "Duplicate email registration rejected")
    if (!duplicateReg.success) {
      assert(
        duplicateReg.error.includes("already exists") || duplicateReg.error.includes("Unable to complete"),
        `Clear, secure message returned: '${duplicateReg.error}'`
      )
    }

    // ── SECTION 4: Multi-Tenant Workspace Isolation ──
    console.log("\n── 4. Multi-Tenant Workspace & Server Action Isolation ──")

    // Register User B
    const regResultB = await registerUserAction({
      name: TEST_USER_B.name,
      email: TEST_USER_B.email,
      password: TEST_USER_B.password,
      confirmPassword: TEST_USER_B.password,
    })
    assert(regResultB.success, "Successfully registers new user B")
    if (regResultB.success) userBId = regResultB.data.id

    // Act as User A
    process.env.TEST_AUTH_USER_ID = userAId
    const userAContext = await resolveCurrentUser()
    assert(userAContext.id === userAId, "resolveCurrentUser correctly returns User A identity")

    // User A creates Project A
    const createProjectRes = await createProjectAction({
      name: "Alpha Defense Protocol",
      description: "Classified project belonging exclusively to User A",
      color: "#6366f1",
    })
    assert(createProjectRes.success, "User A successfully creates Project A")
    const projectAId = createProjectRes.success ? createProjectRes.data.id : ""

    // User A creates Task in Project A
    const createTaskRes = await createTaskAction({
      title: "Calibrate Sensors",
      projectId: projectAId,
      status: "TODO",
      priority: "HIGH",
    })
    assert(createTaskRes.success, "User A creates Task A under Project A")
    const taskAId = createTaskRes.success ? createTaskRes.data.id : ""

    // Switch to User B
    process.env.TEST_AUTH_USER_ID = userBId
    const userBContext = await resolveCurrentUser()
    assert(userBContext.id === userBId, "resolveCurrentUser switches context to User B")

    // User B fetches projects
    const userBProjects = await getProjectsAction()
    assert(userBProjects.success, "User B gets projects")
    assert(
      userBProjects.success && !userBProjects.data.some((p) => p.id === projectAId),
      "User B cannot see User A's Project (Zero-leak read isolation)"
    )

    // User B fetches tasks
    const userBTasks = await getTasksAction()
    assert(userBTasks.success, "User B gets tasks")
    assert(
      userBTasks.success && !userBTasks.data.some((t) => t.id === taskAId),
      "User B cannot see User A's Task (Zero-leak read isolation)"
    )

    // User B attempts to DELETE User A's project
    const unauthorizedDelete = await deleteProjectAction(projectAId)
    assert(
      !unauthorizedDelete.success,
      "User B cannot delete User A's project (Ownership enforcement holds)"
    )

    // ── SECTION 5: Unauthenticated Rejection ──
    console.log("\n── 5. Unauthenticated Server Action Rejection ──")

    // Clear test user id and ensure no session
    delete process.env.TEST_AUTH_USER_ID
    delete process.env.ALLOW_DEMO_FALLBACK

    let rejectedWithoutAuth = false
    try {
      await resolveCurrentUser()
    } catch (err: unknown) {
      if (err instanceof Error) {
        rejectedWithoutAuth = err.message.includes("UNAUTHORIZED")
      }
    }
    assert(rejectedWithoutAuth, "resolveCurrentUser throws UNAUTHORIZED when no valid session is present")

    // ── SECTION 6: Demo User Data Preservation ──
    console.log("\n── 6. Demo User & Neon Database Preservation ──")

    const demoUser = await prisma.user.findUnique({
      where: { id: DEMO_USER_ID },
      include: {
        projects: true,
        tasks: true,
        notes: true,
        preferences: true,
      },
    })

    assert(!!demoUser, "Demo User ('usr_demo_nexora_dev') exists in Neon PostgreSQL")
    assert((demoUser?.projects.length ?? 0) >= 3, `Demo User projects preserved: count = ${demoUser?.projects.length}`)
    assert((demoUser?.tasks.length ?? 0) >= 12, `Demo User tasks preserved: count = ${demoUser?.tasks.length}`)
    assert((demoUser?.notes.length ?? 0) >= 4, `Demo User notes preserved: count = ${demoUser?.notes.length}`)
    assert(!!demoUser?.preferences, "Demo User preferences preserved")

    console.log("\n=================================================================")
    console.log(`  VERIFICATION COMPLETE: ${passed} PASSED / ${failed} FAILED`)
    console.log("=================================================================\n")
  } finally {
    // ── CLEANUP TEST ARTIFACTS ──
    console.log("── Cleaning up test records from Neon PostgreSQL ──")
    if (userAId) {
      await prisma.task.deleteMany({ where: { userId: userAId } })
      await prisma.note.deleteMany({ where: { userId: userAId } })
      await prisma.project.deleteMany({ where: { userId: userAId } })
      await prisma.activity.deleteMany({ where: { userId: userAId } })
      await prisma.userPreferences.deleteMany({ where: { userId: userAId } })
      await prisma.user.delete({ where: { id: userAId } }).catch(() => {})
    }
    if (userBId) {
      await prisma.task.deleteMany({ where: { userId: userBId } })
      await prisma.note.deleteMany({ where: { userId: userBId } })
      await prisma.project.deleteMany({ where: { userId: userBId } })
      await prisma.activity.deleteMany({ where: { userId: userBId } })
      await prisma.userPreferences.deleteMany({ where: { userId: userBId } })
      await prisma.user.delete({ where: { id: userBId } }).catch(() => {})
    }
    delete process.env.TEST_AUTH_USER_ID
    console.log("✓ Test records cleaned up successfully.\n")
  }

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase5AuthVerification().catch((err) => {
  console.error("FATAL: Verification failed with exception:", err)
  process.exit(1)
})
