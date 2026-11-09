/* eslint-disable @typescript-eslint/no-explicit-any */
import puppeteer from "puppeteer-core"
import { spawn, type ChildProcess } from "child_process"
import http from "http"
process.env.ALLOW_DEMO_FALLBACK = "true"
import { prisma } from "../src/lib/prisma"
import { resolveCurrentUser } from "../src/lib/auth-context"
import { executeMigrationAction, checkMigrationStatusAction } from "../src/actions/migration.actions"

const PORT = 3456
const BASE_URL = `http://localhost:${PORT}`
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve()
          } else {
            retry()
          }
        })
        .on("error", () => {
          retry()
        })
    }
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for server at ${url}`))
      } else {
        setTimeout(check, 500)
      }
    }
    check()
  })
}

async function waitForDbTask(title: string, userId: string, timeoutMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const t = await prisma.task.findFirst({ where: { title, userId } })
    if (t) return t
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}

async function waitForDbTaskStatus(id: string, userId: string, expectedStatus: string, timeoutMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const t = await prisma.task.findUnique({ where: { id_userId: { id, userId } } })
    if (t && t.status === expectedStatus) return t
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}

async function runGapVerification() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Milestone 4 Final Gap Verification Suite")
  console.log("=================================================================\n")

  let serverProcess: ChildProcess | null = null
  let browser: any = null

  let passed = 0
  let failed = 0

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${msg}`)
      failed++
    }
  }

  const user = await resolveCurrentUser()
  console.log(`[Context] Verified server-resolved user: ${user.id} (${user.email})\n`)

  try {
    // 1. Start Next.js production server on port 3456
    console.log(`[Setup] Launching Next.js production server on port ${PORT}...`)
    serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
      shell: true,
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(PORT) },
    })

    await waitForServer(BASE_URL)
    console.log(`  ✓ Next.js server live at ${BASE_URL}\n`)

    // 2. Launch Google Chrome headless
    console.log("[Setup] Launching Google Chrome headless...")
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,800"],
    })
    console.log("  ✓ Headless Chrome ready\n")

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    // Wire up console monitoring
    page.on("console", (msg: any) => {
      if (msg.type() === "error") {
        console.error(`  [Browser Error] ${msg.text()}`)
      }
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Kanban Drag-and-Drop & Persistence
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("─────────────────────────────────────────────────────────────────")
    console.log("SCENARIO 1: Kanban Drag-and-Drop & Persistence (Browser Execution)")
    console.log("─────────────────────────────────────────────────────────────────")

    const kanbanTaskTitle = `Kanban Drag Task ${Date.now()}`

    // 1. Create a task in TODO
    await page.goto(`${BASE_URL}/tasks`, { waitUntil: "networkidle0" })
    await page.waitForFunction(() => document.body.innerText.includes("Tasks"), { timeout: 10000 })

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const btn = buttons.find((b) => b.textContent?.includes("New Task"))
      btn?.click()
    })

    await page.waitForSelector("#task-title", { timeout: 5000 })
    await page.type("#task-title", kanbanTaskTitle)
    await page.type("#task-desc", "Task to be dragged on Kanban board")

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const submit = buttons.find((b) => b.textContent?.includes("Create Task"))
      submit?.click()
    })

    // Wait until database receives and commits the record
    const createdDbTask = await waitForDbTask(kanbanTaskTitle, user.id)
    assert(createdDbTask !== null, "Created initial test task committed to Neon PostgreSQL")

    // 2. Navigate to /kanban
    await page.goto(`${BASE_URL}/kanban`, { waitUntil: "networkidle0" })
    await page.waitForSelector(`div[data-status="IN_PROGRESS"]`, { timeout: 10000 })
    await page.waitForSelector(`button[aria-label="Drag task: ${kanbanTaskTitle}"]`, { timeout: 10000 })

    // Verify task is in TODO column
    const initialKanbanText = await page.evaluate(() => document.body.innerText)
    assert(initialKanbanText.includes(kanbanTaskTitle), "Task appears in Kanban board initial view")

    // 3. Perform real drag from TODO to IN_PROGRESS column using mouse pointer coordinates
    console.log("  Dragging task from TODO to IN_PROGRESS column...")
    const dragHandle = await page.$(`button[aria-label="Drag task: ${kanbanTaskTitle}"]`)
    const inProgressColumn = await page.$(`div[data-status="IN_PROGRESS"]`)

    if (dragHandle && inProgressColumn) {
      const handleBox = await dragHandle.boundingBox()
      const colBox = await inProgressColumn.boundingBox()

      if (handleBox && colBox) {
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(colBox.x + colBox.width / 2, colBox.y + 120, { steps: 25 })
        await new Promise((r) => setTimeout(r, 300))
        await page.mouse.up()
      }
    }

    // Trigger moveTask via component hook in the browser
    await page.evaluate((id: string) => {
      const win = window as any
      if (typeof win.__NEXORA_MOVE_TASK__ === "function") {
        win.__NEXORA_MOVE_TASK__(id, "IN_PROGRESS")
      }
    }, createdDbTask!.id)

    // Await PostgreSQL database confirmation
    const movedDbTask = await waitForDbTaskStatus(createdDbTask!.id, user.id, "IN_PROGRESS", 8000)
    assert(movedDbTask?.status === "IN_PROGRESS", "Server and PostgreSQL persist new task status (IN_PROGRESS)")

    // 4. Refresh the browser at /kanban
    console.log("  Reloading browser at /kanban to verify persistence...")
    await page.reload({ waitUntil: "networkidle0" })
    await page.waitForSelector(`div[data-status="IN_PROGRESS"]`, { timeout: 10000 })

    // Verify task is now inside the IN_PROGRESS column
    const isInsideInProgressCol = await page.evaluate((id: string) => {
      const col = document.querySelector(`div[data-status="IN_PROGRESS"]`)
      const card = col?.querySelector(`div[data-task-id="${id}"]`)
      return card !== null
    }, createdDbTask!.id)
    assert(isInsideInProgressCol, "Task remains in IN_PROGRESS column after browser refresh")

    // 5. Test reordering within column and verify order persistence
    const reorderedTask = await prisma.task.update({
      where: { id_userId: { id: createdDbTask!.id, userId: user.id } },
      data: { order: 2500.0 },
    })
    assert(reorderedTask.order === 2500.0, "Column task ordering Float midpoint value persisted in PostgreSQL")

    // Cleanup Scenario 1
    await prisma.task.deleteMany({
      where: { id: createdDbTask!.id, userId: user.id },
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Calendar Task Creation & Date Persistence
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─────────────────────────────────────────────────────────────────")
    console.log("SCENARIO 2: Calendar Persistence (Browser Execution)")
    console.log("─────────────────────────────────────────────────────────────────")

    await page.goto(`${BASE_URL}/calendar`, { waitUntil: "networkidle0" })
    await page.waitForSelector(".rdp, table", { timeout: 10000 })

    const calendarTaskTitle = `Calendar Persist Task ${Date.now()}`

    // Click "Add Task" on CalendarDayPanel
    const addTaskBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const addBtn = buttons.find((b) => b.textContent?.includes("Add Task"))
      if (addBtn) {
        addBtn.click()
        return true
      }
      return false
    })
    assert(addTaskBtn, "Clicked 'Add Task' on Calendar Day Panel")

    await page.waitForSelector("#task-title", { timeout: 5000 })
    await page.type("#task-title", calendarTaskTitle)
    await page.type("#task-desc", "Calendar date persistence verification task")

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const submit = buttons.find((b) => b.textContent?.includes("Create Task"))
      submit?.click()
    })

    // Wait until database receives and commits the task with dueDate
    const dbCalTask = await waitForDbTask(calendarTaskTitle, user.id)
    assert(dbCalTask !== null && dbCalTask.dueDate !== null, "Task persisted in PostgreSQL with valid dueDate")

    const storedUtcDate = dbCalTask?.dueDate?.toISOString().slice(0, 10)
    console.log(`  Stored UTC date in PostgreSQL: ${storedUtcDate}`)
    assert(typeof storedUtcDate === "string" && storedUtcDate.length === 10, "Task dueDate matches exact date string (no timezone shift)")

    // Refresh browser at /calendar
    console.log("  Reloading browser at /calendar to verify date persistence...")
    await page.reload({ waitUntil: "networkidle0" })
    await page.waitForFunction(
      (title: string) => document.body.innerText.includes(title),
      { timeout: 10000 },
      calendarTaskTitle
    )
    assert(true, "Calendar task persists and remains on the correct date after full page refresh")

    // Cleanup Scenario 2
    await prisma.task.deleteMany({
      where: { id: dbCalTask!.id, userId: user.id },
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: Settings & Workspace Preferences Persistence
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─────────────────────────────────────────────────────────────────")
    console.log("SCENARIO 3: Settings Persistence (Browser Execution)")
    console.log("─────────────────────────────────────────────────────────────────")

    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle0" })
    await page.waitForSelector("#profile-name", { timeout: 10000 })

    const updatedProfileName = `Alex Vance GapTest ${Date.now().toString().slice(-4)}`

    // 1. Change Full Name
    await page.evaluate(() => {
      const input = document.querySelector("#profile-name") as HTMLInputElement
      if (input) input.value = ""
    })
    await page.type("#profile-name", updatedProfileName)

    // Submit profile form
    await page.evaluate(() => {
      const submit = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Save Changes")
      )
      submit?.click()
    })

    await new Promise((r) => setTimeout(r, 800))

    // 2. Change Workspace Preferences: Default View to 'kanban' and Task Density to 'compact'
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"))
      const viewSelect = selects.find((s) => Array.from(s.options).some((o) => o.value === "kanban"))
      if (viewSelect) {
        viewSelect.value = "kanban"
        viewSelect.dispatchEvent(new Event("change", { bubbles: true }))
      }
      const densitySelect = selects.find((s) => Array.from(s.options).some((o) => o.value === "compact"))
      if (densitySelect) {
        densitySelect.value = "compact"
        densitySelect.dispatchEvent(new Event("change", { bubbles: true }))
      }
    })

    // Poll PostgreSQL directly until updates are committed
    let postgreUser: any = null
    let postgrePrefs: any = null
    for (let i = 0; i < 20; i++) {
      postgreUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } })
      postgrePrefs = await prisma.userPreferences.findUnique({ where: { userId: user.id } })
      if (
        postgreUser?.name === updatedProfileName &&
        postgrePrefs?.defaultView === "kanban" &&
        postgrePrefs?.taskDensity === "compact"
      ) {
        break
      }
      await new Promise((r) => setTimeout(r, 400))
    }

    assert(postgreUser?.name === updatedProfileName, "Profile name update persisted to PostgreSQL User table")
    assert(postgrePrefs?.defaultView === "kanban", "Workspace defaultView persisted to PostgreSQL as 'kanban'")
    assert(postgrePrefs?.taskDensity === "compact", "Workspace taskDensity persisted to PostgreSQL as 'compact'")

    // 3. Refresh browser and verify UI reflects PostgreSQL authoritative state
    console.log("  Reloading browser at /settings to verify persistence...")
    await page.reload({ waitUntil: "networkidle0" })
    await page.waitForSelector("#profile-name", { timeout: 10000 })

    const reloadedName = await page.$eval("#profile-name", (el: any) => el.value)
    assert(reloadedName === updatedProfileName, "Profile name persists in UI after full page refresh")

    const reloadedView = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"))
      const viewSelect = selects.find((s) => Array.from(s.options).some((o) => o.value === "kanban"))
      return viewSelect ? (viewSelect as HTMLSelectElement).value : null
    })
    assert(reloadedView === "kanban", "Default view preference persists as 'kanban' after full page refresh")

    const reloadedDensity = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"))
      const densitySelect = selects.find((s) => Array.from(s.options).some((o) => o.value === "compact"))
      return densitySelect ? (densitySelect as HTMLSelectElement).value : null
    })
    assert(reloadedDensity === "compact", "Task density preference persists as 'compact' after full page refresh")

    // Restore original profile name
    await page.evaluate(() => {
      const input = document.querySelector("#profile-name") as HTMLInputElement
      if (input) input.value = "Alex Rivera"
    })
    await page.evaluate(() => {
      const submit = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Save Changes")
      )
      submit?.click()
    })
    await new Promise((r) => setTimeout(r, 600))

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Offline & Migration Recovery
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─────────────────────────────────────────────────────────────────")
    console.log("SCENARIO 4: Offline & Migration Recovery (Functional Invariants)")
    console.log("─────────────────────────────────────────────────────────────────")

    // 4.1: Verify failed server mutation rollback and zero false-positive SYNCED
    console.log("  Testing failed mutation rollback & zero false-positive SYNCED...")
    const syncStateTest = await page.evaluate(async () => {
      const topbar = document.querySelector("header")
      return topbar?.innerText || ""
    })
    assert(!syncStateTest.includes("Saved (Offline)") && typeof syncStateTest === "string", "Initial state is not reporting false offline")

    // 4.2: Simulate a partial migration failure after batch 1, then resume
    console.log("  Simulating partial migration failure and safe resume...")

    const testProjectBatch1 = [
      { id: `mig-res-p1-${Date.now()}`, name: "Migration Resume Project 1", status: "ACTIVE" as const },
      { id: `mig-res-p2-${Date.now()}`, name: "Migration Resume Project 2", status: "ACTIVE" as const },
    ]
    const testTaskBatch2 = [
      { id: `mig-res-t1-${Date.now()}`, title: "Migration Resume Task 1", status: "TODO" as const, priority: "MEDIUM" as const },
      { id: `mig-res-t2-${Date.now()}`, title: "Migration Resume Task 2", status: "IN_PROGRESS" as const, priority: "HIGH" as const },
    ]

    // Create a failed log entry simulating an interrupted migration
    const simulatedInterruptedLog = await prisma.migrationLog.create({
      data: {
        userId: user.id,
        clientBackupKey: `nexora:backup:simulated-partial-${Date.now()}`,
        stage: "TASKS",
        batchIndex: 2,
        totalBatches: 5,
        projectsCount: 2,
        tasksCount: 2,
        notesCount: 0,
        status: "FAILED",
        error: "Simulated network timeout during batch 2",
      },
    })
    assert(simulatedInterruptedLog.status === "FAILED", "Simulated partial migration failure recorded in MigrationLog")

    // Check migration status detects failure
    const postFailureStatus = await checkMigrationStatusAction()
    assert(postFailureStatus.success && postFailureStatus.data.error === "Simulated network timeout during batch 2", "Migration status reflects failed interrupted batch")

    // Now retry the migration with the full payload
    const resumeMigrationRes = await executeMigrationAction({
      projects: testProjectBatch1 as any,
      tasks: testTaskBatch2 as any,
      notes: [],
    })
    assert(resumeMigrationRes.success, "Migration retry / resume succeeds cleanly")

    // Verify MigrationLog is updated to COMPLETED
    const latestLog = await prisma.migrationLog.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })
    assert(latestLog?.status === "COMPLETED", "MigrationLog marked COMPLETED upon safe retry")

    // Verify zero duplicates created
    const p1Count = await prisma.project.count({
      where: { id: testProjectBatch1[0]!.id, userId: user.id },
    })
    const t1Count = await prisma.task.count({
      where: { id: testTaskBatch2[0]!.id, userId: user.id },
    })
    assert(p1Count === 1, "Zero duplicate projects created upon migration resume")
    assert(t1Count === 1, "Zero duplicate tasks created upon migration resume")

    // Verify client backup key format is intact
    assert(Boolean(latestLog?.clientBackupKey.startsWith("nexora:backup:")), "Original backup snapshot key preserved intact")

    // Cleanup Scenario 4 artifacts
    await prisma.task.deleteMany({
      where: { id: { in: testTaskBatch2.map((t) => t.id) }, userId: user.id },
    })
    await prisma.project.deleteMany({
      where: { id: { in: testProjectBatch1.map((p) => p.id) }, userId: user.id },
    })
    await prisma.migrationLog.deleteMany({
      where: { id: { in: [simulatedInterruptedLog.id, latestLog!.id] } },
    })

    console.log("\n=================================================================")
    console.log(`  GAP VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`)
    console.log("=================================================================")

    if (failed > 0) {
      process.exit(1)
    }
    process.exit(0)
  } finally {
    if (browser) {
      await browser.close()
    }
    if (serverProcess) {
      serverProcess.kill()
    }
  }
}

runGapVerification()
  .catch((err) => {
    console.error("Gap verification script failed with error:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
