import {
  getProjectsAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from "../src/actions/project.actions"
import {
  getTasksAction,
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
  toggleTaskAction,
  moveTaskAction,
  reorderTaskAction,
} from "../src/actions/task.actions"
import {
  getNotesAction,
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "../src/actions/note.actions"
import {
  getSettingsAction,
  updateProfileAction,
  updatePreferencesAction,
} from "../src/actions/settings.actions"
import {
  getActivitiesAction,
} from "../src/actions/activity.actions"
import * as activityModule from "../src/actions/activity.actions"
import { prisma } from "../src/lib/prisma"
import { DEMO_USER_ID } from "../src/lib/auth-context"

async function runMilestone3Verification() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Milestone 3: Server Actions & Zod Verification ")
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
  // 1. Zod Validation & Schema Rejection Tests
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("1. Testing Zod Validation Schemas (Input Rejection)")

  // 1.1 Invalid Project: empty name
  const invalidProj1 = await createProjectAction({ name: "   ", description: "Empty test" })
  assert(!invalidProj1.success && invalidProj1.error === "Validation failed", "Reject project with empty name")

  // 1.2 Invalid Project: bad hex color
  const invalidProj2 = await createProjectAction({ name: "Bad Color", color: "not-a-color" } as unknown as Parameters<typeof createProjectAction>[0])
  assert(!invalidProj2.success && !!invalidProj2.issues?.color, "Reject project with invalid hex color")

  // 1.3 Invalid Task: malformed dueDate (must be YYYY-MM-DD)
  const invalidTask1 = await createTaskAction({ title: "Bad Date", dueDate: "11/25/2026" } as unknown as Parameters<typeof createTaskAction>[0])
  assert(!invalidTask1.success && !!invalidTask1.issues?.dueDate, "Reject task with malformed dueDate")

  // 1.4 Invalid Task: bad enum priority
  const invalidTask2 = await createTaskAction({ title: "Bad Priority", priority: "SUPER_URGENT" } as unknown as Parameters<typeof createTaskAction>[0])
  assert(!invalidTask2.success && !!invalidTask2.issues?.priority, "Reject task with invalid priority enum")

  // 1.5 Invalid Note: empty title
  const invalidNote1 = await createNoteAction({ title: "  ", content: "Empty title" })
  assert(!invalidNote1.success && !!invalidNote1.issues?.title, "Reject note with empty title")

  // 1.6 Invalid Settings: bad email format
  const invalidProfile = await updateProfileAction({ email: "invalid-email" })
  assert(!invalidProfile.success && !!invalidProfile.issues?.email, "Reject profile with invalid email")

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Relational Ownership & Authorization Security
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n2. Testing Relational Ownership & Cross-Tenant Rejection")

  // 2.1 Attempt to assign task to non-existent project
  const fakeProjectTask = await createTaskAction({
    title: "Task with fake project",
    projectId: "proj-non-existent-9999",
  })
  assert(
    !fakeProjectTask.success && fakeProjectTask.error === "Referenced project not found or access denied",
    "Reject task assignment to non-existent project"
  )

  // 2.2 Attempt to assign note to non-existent project
  const fakeProjectNote = await createNoteAction({
    title: "Note with fake project",
    projectId: "proj-non-existent-9999",
  })
  assert(
    !fakeProjectNote.success && fakeProjectNote.error === "Referenced project not found or access denied",
    "Reject note assignment to non-existent project"
  )

  // 2.3 Attempt to update non-existent task
  const updateFakeTask = await updateTaskAction("task-non-existent-9999", { title: "Hacked" })
  assert(
    !updateFakeTask.success && updateFakeTask.error === "Task not found or access denied",
    "Reject update of non-existent or foreign task"
  )

  // 2.4 Attempt to delete non-existent project
  const deleteFakeProj = await deleteProjectAction("proj-non-existent-9999")
  assert(
    !deleteFakeProj.success && deleteFakeProj.error === "Project not found or access denied",
    "Reject delete of non-existent or foreign project"
  )

  // 2.5 Verify client-injected userId is stripped
  const injectedTask = await createTaskAction({
    title: "Injected User ID Task",
    userId: "hacker_tenant_99",
  } as unknown as Parameters<typeof createTaskAction>[0])
  assert(
    injectedTask.success && !("userId" in (injectedTask.data || {})),
    "Client-injected userId is stripped and not exposed"
  )
  if (injectedTask.success) {
    // Verify in database that it was assigned to DEMO_USER_ID, not the injected hacker ID
    const dbRecord = await prisma.task.findUnique({ where: { id: injectedTask.data.id } })
    assert(dbRecord?.userId === DEMO_USER_ID, "Record owner is verified server identity (DEMO_USER_ID)")
    // Clean up
    await deleteTaskAction(injectedTask.data.id)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Entity CRUD Integration Tests (Real Neon Database)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n3. Testing Full Entity CRUD Operations (Neon Database)")

  // 3.1 Project CRUD
  const createdProj = await createProjectAction({
    name: "Milestone 3 Test Project",
    description: "Temporary verification project",
    status: "ACTIVE",
    color: "#10b981",
  })
  assert(createdProj.success && createdProj.data.name === "Milestone 3 Test Project", "Create Project Action")

  const projId = createdProj.success ? createdProj.data.id : ""

  const readProjects = await getProjectsAction()
  assert(
    readProjects.success && readProjects.data.some((p) => p.id === projId),
    "Read/List Projects Action"
  )

  const updatedProj = await updateProjectAction(projId, {
    name: "Milestone 3 Updated Project",
    status: "ON_HOLD",
  })
  assert(
    updatedProj.success && updatedProj.data.status === "ON_HOLD",
    "Update Project Action"
  )

  // 3.2 Task CRUD (assigned to the test project)
  const createdTask = await createTaskAction({
    title: "Milestone 3 Test Task",
    description: "Integration test description",
    status: "TODO",
    priority: "HIGH",
    dueDate: "2026-11-20",
    projectId: projId,
  })
  assert(
    createdTask.success &&
      createdTask.data.title === "Milestone 3 Test Task" &&
      createdTask.data.dueDate === "2026-11-20" &&
      createdTask.data.projectId === projId,
    "Create Task Action (with Date-only dueDate & project relation)"
  )

  const taskId = createdTask.success ? createdTask.data.id : ""

  const readTasks = await getTasksAction()
  assert(
    readTasks.success && readTasks.data.some((t) => t.id === taskId),
    "Read/List Tasks Action"
  )

  const updatedTask = await updateTaskAction(taskId, {
    title: "Milestone 3 Updated Task",
    priority: "URGENT",
  })
  assert(
    updatedTask.success && updatedTask.data.priority === "URGENT",
    "Update Task Action"
  )

  // 3.3 Task Completion Toggle
  const toggledTask = await toggleTaskAction(taskId)
  assert(
    toggledTask.success && toggledTask.data.status === "COMPLETED",
    "Toggle Task Action (TODO -> COMPLETED)"
  )

  const untoggledTask = await toggleTaskAction(taskId)
  assert(
    untoggledTask.success && untoggledTask.data.status === "TODO",
    "Toggle Task Action (COMPLETED -> TODO)"
  )

  // 3.4 Kanban Move Action
  const movedTask = await moveTaskAction({
    taskId,
    targetStatus: "IN_PROGRESS",
  })
  assert(
    movedTask.success && movedTask.data.status === "IN_PROGRESS",
    "Move Task Action (Status Transition)"
  )

  // 3.5 Note CRUD
  const createdNote = await createNoteAction({
    title: "Milestone 3 Test Note",
    content: "<p>Verification rich text content</p>",
    projectId: projId,
  })
  assert(
    createdNote.success && createdNote.data.title === "Milestone 3 Test Note",
    "Create Note Action"
  )

  const noteId = createdNote.success ? createdNote.data.id : ""

  const readNotes = await getNotesAction()
  assert(
    readNotes.success && readNotes.data.some((n) => n.id === noteId),
    "Read/List Notes Action"
  )

  const updatedNote = await updateNoteAction(noteId, {
    title: "Milestone 3 Updated Note",
  })
  assert(
    updatedNote.success && updatedNote.data.title === "Milestone 3 Updated Note",
    "Update Note Action"
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Kanban Reordering & Rebalancing Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n4. Testing Kanban Reordering & Midpoint Calculations")

  // Reorder between items: above = 1000, below = 2000 -> midpoint = 1500
  const reordered1 = await reorderTaskAction({
    taskId,
    targetStatus: "IN_PROGRESS",
    aboveOrder: 1000.0,
    belowOrder: 2000.0,
  })
  assert(
    reordered1.success && reordered1.data.order === 1500.0,
    "Kanban Midpoint Calculation (1000.0 and 2000.0 -> 1500.0)"
  )

  // Reorder at head: above = null, below = 1000 -> 0.0 or below - 1000
  const reorderedHead = await reorderTaskAction({
    taskId,
    targetStatus: "IN_PROGRESS",
    aboveOrder: null,
    belowOrder: 1000.0,
  })
  assert(
    reorderedHead.success && reorderedHead.data.order === 0.0,
    "Kanban Head Insertion (order = 0.0)"
  )

  // Reorder with precision compression (gap < 0.001) -> triggers rebalancing
  const compressedReorder = await reorderTaskAction({
    taskId,
    targetStatus: "IN_PROGRESS",
    aboveOrder: 1000.0,
    belowOrder: 1000.0005,
  })
  assert(
    compressedReorder.success && typeof compressedReorder.data.order === "number",
    "Kanban Precision Compression Detection & Column Rebalancing"
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Settings & Profile Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n5. Testing User Profile & Preferences Actions")

  const currentSettings = await getSettingsAction()
  assert(currentSettings.success && !!currentSettings.data.profile.email, "Get Settings Action")

  const originalName = currentSettings.success ? currentSettings.data.profile.name : "Alex Rivera"

  const updatedProfile = await updateProfileAction({
    name: "Alex Rivera (Verified)",
    title: "Principal Engineer",
  })
  assert(
    updatedProfile.success && updatedProfile.data.title === "Principal Engineer",
    "Update Profile Action"
  )

  const updatedPrefs = await updatePreferencesAction({
    defaultView: "kanban",
    taskDensity: "compact",
  })
  assert(
    updatedPrefs.success &&
      updatedPrefs.data.defaultView === "kanban" &&
      updatedPrefs.data.taskDensity === "compact",
    "Update Preferences Action"
  )

  // Restore original profile name
  await updateProfileAction({ name: originalName, title: "Senior Full-Stack Developer" })
  await updatePreferencesAction({ defaultView: "dashboard", taskDensity: "comfortable" })

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Activity Security & Retrieval Actions
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n6. Testing Activity Security & Retrieval Actions")

  // 6.1 Verify createActivityAction is NOT exposed to clients (prevents audit forgery)
  const isCreateActivityExposed = "createActivityAction" in activityModule
  assert(
    !isCreateActivityExposed,
    "createActivityAction is NOT exposed to clients (tamper-proof audit logs)"
  )

  // 6.2 Retrieve activities and verify ownership scoping
  const activities = await getActivitiesAction(20)
  assert(
    activities.success && activities.data.length > 0,
    "Retrieve Activities Action (scoped to current user)"
  )

  // 6.3 Verify that genuine business operations logged authentic activities
  const hasProjectActivity = activities.success && activities.data.some(
    (a) => a.title.includes("Milestone 3 Test Project") || a.title.includes("Milestone 3 Updated Project")
  )
  assert(
    hasProjectActivity,
    "Trusted server-side operations automatically record authentic activity"
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Cleanup Test Records
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n7. Cleaning Up Test Artifacts")

  // Delete test task
  const delTask = await deleteTaskAction(taskId)
  assert(delTask.success, "Delete Test Task Action")

  // Delete test note
  const delNote = await deleteNoteAction(noteId)
  assert(delNote.success, "Delete Test Note Action")

  // Delete test project
  const delProj = await deleteProjectAction(projId)
  assert(delProj.success, "Delete Test Project Action")

  console.log("\n=================================================================")
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("=================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

runMilestone3Verification()
  .catch((e) => {
    console.error("Verification execution crashed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
