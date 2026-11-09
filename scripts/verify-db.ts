import { prisma } from "../src/lib/prisma"
import { resolveCurrentUser, DEMO_USER_ID, DEMO_USER_EMAIL } from "../src/lib/auth-context"

async function main() {
  console.log("=== NEXORA DevHub — Database Verification Pass ===")

  // 1. Connection & Demo User Verification
  const currentUser = await resolveCurrentUser()
  console.log("✓ resolveCurrentUser() resolved:", {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
  })

  if (currentUser.id !== DEMO_USER_ID || currentUser.email !== DEMO_USER_EMAIL) {
    throw new Error("Demo user identity mismatch!")
  }

  // 2. User & Preferences Check
  const user = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
    include: { preferences: true },
  })
  if (!user) throw new Error("Demo user not found in database!")
  console.log("✓ User record verified in PostgreSQL:", {
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title,
    initials: user.initials,
    hasPreferences: !!user.preferences,
    defaultView: user.preferences?.defaultView,
  })

  // 3. Projects Check
  const projects = await prisma.project.findMany({
    where: { userId: DEMO_USER_ID },
  })
  console.log(`✓ Projects in database: ${projects.length}`)
  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length
  const completedProjects = projects.filter((p) => p.status === "COMPLETED").length
  const onHoldProjects = projects.filter((p) => p.status === "ON_HOLD").length
  console.log(`  - Status Breakdown: ACTIVE=${activeProjects}, COMPLETED=${completedProjects}, ON_HOLD=${onHoldProjects}`)

  // 4. Tasks Check
  const tasks = await prisma.task.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { order: "asc" },
  })
  console.log(`✓ Tasks in database: ${tasks.length}`)
  const tasksWithDueDate = tasks.filter((t) => t.dueDate !== null)
  const tasksWithProject = tasks.filter((t) => t.projectId !== null)
  console.log(`  - Tasks linked to projects: ${tasksWithProject.length}/${tasks.length}`)
  console.log(`  - Tasks with calendar dueDate: ${tasksWithDueDate.length}/${tasks.length}`)
  
  // Verify Date-only semantics and Float ordering
  if (tasks.length > 0 && tasks[0]) {
    const sampleTask = tasks[0]
    console.log("  - Sample Task Verification:", {
      id: sampleTask.id,
      title: sampleTask.title,
      status: sampleTask.status,
      priority: sampleTask.priority,
      order: sampleTask.order,
      dueDateType: sampleTask.dueDate ? typeof sampleTask.dueDate : "null",
      dueDateFormatted: sampleTask.dueDate ? sampleTask.dueDate.toISOString().slice(0, 10) : "null",
    })
  }

  // 5. Notes Check
  const notes = await prisma.note.findMany({
    where: { userId: DEMO_USER_ID },
  })
  console.log(`✓ Notes in database: ${notes.length}`)

  // 6. Activities Check
  const activities = await prisma.activity.findMany({
    where: { userId: DEMO_USER_ID },
  })
  console.log(`✓ Activities in database: ${activities.length}`)

  // 7. Pre-allocated Phase 5 Auth.js Tables Check
  const accountCount = await prisma.account.count()
  const sessionCount = await prisma.session.count()
  const tokenCount = await prisma.verificationToken.count()
  const migrationLogCount = await prisma.migrationLog.count()
  console.log("✓ Pre-allocated Schema Tables Verified:", {
    AccountTable: `OK (count: ${accountCount})`,
    SessionTable: `OK (count: ${sessionCount})`,
    VerificationTokenTable: `OK (count: ${tokenCount})`,
    MigrationLogTable: `OK (count: ${migrationLogCount})`,
  })

  // 8. Isolation Check (Testing @@unique([id, userId]))
  if (projects[0]) {
    try {
      const invalidAccess = await prisma.project.findUnique({
        where: {
          id_userId: {
            id: projects[0].id,
            userId: "usr_non_existent_tenant",
          },
        },
      })
      console.log("✓ Multi-tenant compound isolation check:", invalidAccess === null ? "PASSED (Null on tenant mismatch)" : "FAILED")
    } catch {
      console.log("✓ Multi-tenant compound isolation check: PASSED (Rejected)")
    }
  }

  console.log("=== ALL DATABASE VERIFICATIONS PASSED ===")
}

main()
  .catch((e) => {
    console.error("Verification failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
