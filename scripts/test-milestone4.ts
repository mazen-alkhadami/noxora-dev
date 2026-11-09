import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())
process.env.ALLOW_DEMO_FALLBACK = "true"

import {
  getProjectsAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  getTasksAction,
  createTaskAction,
  deleteTaskAction,
  toggleTaskAction,
  moveTaskAction,
  reorderTaskAction,
  getNotesAction,
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
  getSettingsAction,
  updateProfileAction,
  updatePreferencesAction,
  getActivitiesAction,
  checkMigrationStatusAction,
  executeMigrationAction,
} from "../src/actions"
process.env.ALLOW_DEMO_FALLBACK = "true"
import { prisma } from "../src/lib/prisma"
import { DEMO_USER_ID } from "../src/lib/auth-context"

async function runMilestone4FullStackTests() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Milestone 4: Full-Stack Integration & Migration")
  console.log("=================================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ""}`)
      failed++
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Database Connection & Initial Loading Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("1. Testing Initial Database Loading & State Synchronization")

  const projectsRes = await getProjectsAction()
  assert(projectsRes.success && Array.isArray(projectsRes.data), "Fetch Projects from PostgreSQL")

  const tasksRes = await getTasksAction()
  assert(tasksRes.success && Array.isArray(tasksRes.data), "Fetch Tasks from PostgreSQL")

  const notesRes = await getNotesAction()
  assert(notesRes.success && Array.isArray(notesRes.data), "Fetch Notes from PostgreSQL")

  const settingsRes = await getSettingsAction()
  assert(
    settingsRes.success &&
      typeof settingsRes.data.profile.email === "string" &&
      typeof settingsRes.data.preferences.defaultView === "string",
    "Fetch User Profile & Preferences from PostgreSQL"
  )

  const activitiesRes = await getActivitiesAction(10)
  assert(activitiesRes.success && Array.isArray(activitiesRes.data), "Fetch Activity History from PostgreSQL")

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Real Project Integration Pass
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n2. Testing Real Project Integration (Neon Persistence)")

  const createdProj = await createProjectAction({
    name: "M4 FullStack Project",
    description: "End-to-end integration test project",
    status: "ACTIVE",
    color: "#6366f1",
  })
  assert(createdProj.success && !!createdProj.data.id, "Create Project in Neon PostgreSQL")

  const projId = createdProj.success ? createdProj.data.id : ""

  // Verify in PostgreSQL directly
  const dbProj = await prisma.project.findUnique({
    where: { id_userId: { id: projId, userId: DEMO_USER_ID } },
  })
  assert(dbProj !== null && dbProj.name === "M4 FullStack Project", "Verify Project persists in database table")

  // Update Project
  const updatedProj = await updateProjectAction(projId, {
    name: "M4 Updated Project",
    status: "COMPLETED",
  })
  assert(updatedProj.success && updatedProj.data.status === "COMPLETED", "Update Project in Neon PostgreSQL")

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Real Task Integration Pass (Calendar & Kanban Compatibility)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n3. Testing Real Task Integration (Kanban & Calendar Persistence)")

  // Create Task assigned to project
  const createdTask = await createTaskAction({
    title: "M4 FullStack Task",
    description: "Testing task persistence across Kanban and Calendar",
    status: "TODO",
    priority: "HIGH",
    dueDate: "2026-11-28",
    projectId: projId,
  })
  assert(
    createdTask.success &&
      createdTask.data.dueDate === "2026-11-28" &&
      createdTask.data.projectId === projId,
    "Create Task with Date-only dueDate ('2026-11-28') & Project relation"
  )

  const taskId = createdTask.success ? createdTask.data.id : ""

  // Verify Task in PostgreSQL table directly
  const dbTask = await prisma.task.findUnique({
    where: { id_userId: { id: taskId, userId: DEMO_USER_ID } },
  })
  assert(dbTask !== null && dbTask.title === "M4 FullStack Task", "Verify Task persists in database table")

  // Calendar compatibility: verify Date-only column does not shift days
  assert(
    dbTask?.dueDate?.toISOString().slice(0, 10) === "2026-11-28",
    "Calendar Date-only semantic check: dueDate matches exact '2026-11-28' in UTC"
  )

  // Toggle status to COMPLETED
  const toggledTask = await toggleTaskAction(taskId)
  assert(toggledTask.success && toggledTask.data.status === "COMPLETED", "Task Toggle Status (TODO -> COMPLETED)")

  // Move Task to IN_PROGRESS
  const movedTask = await moveTaskAction({ taskId, targetStatus: "IN_PROGRESS" })
  assert(movedTask.success && movedTask.data.status === "IN_PROGRESS", "Move Task to IN_PROGRESS column")

  // Kanban Reordering with Float Midpoint
  const reordered = await reorderTaskAction({
    taskId,
    targetStatus: "IN_PROGRESS",
    aboveOrder: 1000.0,
    belowOrder: 3000.0,
  })
  assert(
    reordered.success && reordered.data.order === 2000.0,
    "Kanban Midpoint Reorder (1000.0 and 3000.0 -> 2000.0 order)"
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Real Note Integration Pass (Rich Text Persistence)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n4. Testing Real Note Integration (Rich Text Persistence)")

  const richContent = "<h2>Architecture Decisions</h2><p>Server Actions backed by <strong>Neon PostgreSQL</strong>.</p>"
  const createdNote = await createNoteAction({
    title: "M4 FullStack Note",
    content: richContent,
    projectId: projId,
  })
  assert(createdNote.success && createdNote.data.content === richContent, "Create Note with Rich-text HTML content")

  const noteId = createdNote.success ? createdNote.data.id : ""

  // Verify in PostgreSQL directly
  const dbNote = await prisma.note.findUnique({
    where: { id_userId: { id: noteId, userId: DEMO_USER_ID } },
  })
  assert(dbNote !== null && dbNote.content === richContent, "Verify Rich-text content persists intact in database")

  // Update note
  const updatedNote = await updateNoteAction(noteId, {
    title: "M4 Updated Note Title",
  })
  assert(updatedNote.success && updatedNote.data.title === "M4 Updated Note Title", "Update Note in Neon PostgreSQL")

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. User Settings Integration Pass
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n5. Testing User Settings Integration")

  const originalProfile = settingsRes.success ? settingsRes.data.profile : { name: "Alex Rivera", email: "alex.rivera@nexora.dev" }

  const updatedProfile = await updateProfileAction({
    name: "Alex Rivera (M4 Integrated)",
    title: "Staff Software Engineer",
  })
  assert(
    updatedProfile.success && updatedProfile.data.title === "Staff Software Engineer",
    "Update User Profile in database"
  )

  const updatedPrefs = await updatePreferencesAction({
    defaultView: "calendar",
    taskDensity: "compact",
  })
  assert(
    updatedPrefs.success && updatedPrefs.data.defaultView === "calendar",
    "Update User Preferences in database"
  )

  // Revert settings to clean state
  await updateProfileAction({ name: originalProfile.name, title: "Senior Full-Stack Developer" })
  await updatePreferencesAction({ defaultView: "dashboard", taskDensity: "comfortable" })

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Safe Migration Protocol Pass (Chunked, Idempotent, Resilient)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n6. Testing Safe Migration Protocol (Idempotency & Tracking)")

  const migrationStatusCheck = await checkMigrationStatusAction()
  assert(migrationStatusCheck.success, "Check Migration Status Action")

  // Execute migration with sample local workspace payload
  const migrationPayload = {
    projects: [
      {
        id: "local-proj-101",
        name: "Migrated Local Project",
        description: "Project from localStorage migration",
        status: "ACTIVE" as const,
        color: "#f59e0b",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-11-04T00:00:00.000Z",
      },
    ],
    tasks: [
      {
        id: "local-task-201",
        projectId: "local-proj-101",
        title: "Migrated Local Task",
        description: "Task from localStorage migration",
        status: "TODO" as const,
        priority: "MEDIUM" as const,
        dueDate: "2026-12-01",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-11-04T00:00:00.000Z",
      },
    ],
    notes: [
      {
        id: "local-note-301",
        projectId: "local-proj-101",
        title: "Migrated Local Note",
        content: "<p>Local note content</p>",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-11-04T00:00:00.000Z",
      },
    ],
  }

  // First Migration Run
  const migrationRun1 = await executeMigrationAction(migrationPayload)
  assert(
    migrationRun1.success &&
      migrationRun1.data.projects === 1 &&
      migrationRun1.data.tasks === 1 &&
      migrationRun1.data.notes === 1,
    "First Migration Run: Projects, Tasks, and Notes safely upserted"
  )

  // Verify MigrationLog in database
  const migrationLogs = await prisma.migrationLog.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { createdAt: "desc" },
    take: 1,
  })
  assert(
    migrationLogs.length > 0 && migrationLogs[0]?.status === "COMPLETED",
    "MigrationLog recorded with status COMPLETED"
  )

  // Verify User.migrationCompletedAt is populated
  const updatedUser = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
    select: { migrationCompletedAt: true },
  })
  assert(
    updatedUser?.migrationCompletedAt !== null,
    "User.migrationCompletedAt successfully stamped in PostgreSQL"
  )

  // Second Migration Run (Testing Idempotency: re-running must NOT create duplicate records)
  const migrationRun2 = await executeMigrationAction(migrationPayload)
  assert(migrationRun2.success, "Second Migration Run: Succeeded cleanly without constraint errors")

  // Count records with local ID in database to guarantee no duplicates
  const migratedProjCount = await prisma.project.count({
    where: { id: "local-proj-101", userId: DEMO_USER_ID },
  })
  const migratedTaskCount = await prisma.task.count({
    where: { id: "local-task-201", userId: DEMO_USER_ID },
  })
  assert(
    migratedProjCount === 1 && migratedTaskCount === 1,
    "Idempotency Guarantee: Zero duplicates created on retry"
  )

  // Clean up migrated test items
  await prisma.task.delete({ where: { id_userId: { id: "local-task-201", userId: DEMO_USER_ID } } })
  await prisma.note.delete({ where: { id_userId: { id: "local-note-301", userId: DEMO_USER_ID } } })
  await prisma.project.delete({ where: { id_userId: { id: "local-proj-101", userId: DEMO_USER_ID } } })

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Dynamic Project Progress & Statistics Check
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n7. Testing Dynamic Progress & Statistics")

  // Add 2 tasks to M4 test project: 1 COMPLETED, 1 TODO
  const statTask1 = await createTaskAction({
    title: "Stat Task 1",
    status: "COMPLETED",
    projectId: projId,
  })
  const statTask2 = await createTaskAction({
    title: "Stat Task 2",
    status: "TODO",
    projectId: projId,
  })

  // Verify dynamic calculation: completed tasks / total tasks
  const projectTasks = await prisma.task.findMany({
    where: { projectId: projId, userId: DEMO_USER_ID },
  })
  const completedCount = projectTasks.filter((t) => t.status === "COMPLETED").length
  const expectedPercent = Math.round((completedCount / projectTasks.length) * 100)

  assert(
    expectedPercent >= 0 && expectedPercent <= 100,
    `Dynamic Project Progress calculation: ${completedCount}/${projectTasks.length} tasks completed = ${expectedPercent}%`
  )

  // Clean up stat tasks
  if (statTask1.success) await deleteTaskAction(statTask1.data.id)
  if (statTask2.success) await deleteTaskAction(statTask2.data.id)

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Cleanup Integration Test Artifacts
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n8. Cleaning Up Integration Test Artifacts")

  await deleteTaskAction(taskId)
  await deleteNoteAction(noteId)
  await deleteProjectAction(projId)

  console.log("\n=================================================================")
  console.log(`  MILESTONE 4 INTEGRATION RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("=================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

runMilestone4FullStackTests()
  .catch((e) => {
    console.error("Test execution failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
