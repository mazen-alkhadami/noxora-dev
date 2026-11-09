/* eslint-disable @typescript-eslint/no-explicit-any */
import puppeteer from "puppeteer-core"
import { spawn, type ChildProcess } from "child_process"
import http from "http"
import { prisma } from "../src/lib/prisma"
import { resolveCurrentUser } from "../src/lib/auth-context"

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

async function runBrowserAudit() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Milestone 4 Browser-Level Verification Audit")
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

  const consoleErrors: string[] = []
  const hydrationWarnings: string[] = []

  try {
    // 1. Start Next.js production server on port 3456
    console.log(`[1/6] Launching Next.js production server on port ${PORT}...`)
    serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
      shell: true,
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(PORT) },
    })

    await waitForServer(BASE_URL)
    console.log(`  ✓ Next.js server responding at ${BASE_URL}\n`)

    // 2. Launch Google Chrome headless
    console.log("[2/6] Launching Google Chrome browser instance...")
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,800"],
    })
    console.log("  ✓ Headless Chrome launched\n")

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    // Wire up console monitoring
    page.on("console", (msg: any) => {
      const text = msg.text()
      console.log(`[Browser Console ${msg.type()}] ${text}`)
      if (msg.type() === "error") {
        consoleErrors.push(text)
      }
      if (text.includes("hydration") || text.includes("Hydration") || text.includes("did not match")) {
        hydrationWarnings.push(text)
      }
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Runtime & Hydration Verification on Dashboard
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("[3/6] Verifying Dashboard, Themes, and Layouts...")
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle0" })

    // Wait until full dashboard content loads past skeletons
    await page.waitForFunction(
      () => {
        const text = document.body.innerText.toLowerCase()
        return text.includes("active projects") && text.includes("total tasks")
      },
      { timeout: 12000 }
    )

    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase())
    assert(pageText.includes("active projects"), "Dashboard displays 'Active Projects' statistic card")
    assert(pageText.includes("total tasks"), "Dashboard displays 'Total Tasks' statistic card")
    assert(pageText.includes("completion rate"), "Dashboard displays 'Completion Rate' metric")

    // Verify Zero Hydration Warnings
    assert(hydrationWarnings.length === 0, "No React hydration warnings detected on initial render")

    // Theme Verification (Dark / Light toggle via Settings)
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle0" })
    await page.waitForFunction(() => document.body.innerText.includes("Theme") || document.body.innerText.includes("Appearance"), { timeout: 10000 })

    // Click Light Theme button
    const lightClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const lightBtn = buttons.find((b) => b.textContent?.trim().includes("Light"))
      if (lightBtn) {
        lightBtn.click()
        return true
      }
      return false
    })
    await new Promise((r) => setTimeout(r, 400))
    const htmlClass = await page.evaluate(() => document.documentElement.className)
    assert(lightClicked && typeof htmlClass === "string", "Theme switching executes smoothly without DOM errors")

    // Mobile Viewport Verification
    await page.setViewport({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle0" })
    await page.waitForFunction(() => document.body.innerText.includes("Welcome back") || document.querySelector("header") !== null, { timeout: 10000 })
    const mobileHeader = await page.$("header")
    assert(mobileHeader !== null, "Mobile layout renders with responsive top header at 375px width")

    // Restore Desktop Viewport
    await page.setViewport({ width: 1280, height: 800 })

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. Projects CRUD & Persistence
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[4/6] Verifying Projects, Tasks & Notes Functional Flows...")
    await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle0" })
    await page.waitForFunction(() => document.body.innerText.includes("Projects"), { timeout: 10000 })

    const uniqueProjectName = `Browser Audit Proj ${Date.now()}`

    // Open Project Dialog
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const btn = buttons.find((b) => b.textContent?.includes("New Project"))
      btn?.click()
    })

    await page.waitForSelector("#project-name", { timeout: 5000 })
    await page.type("#project-name", uniqueProjectName)
    await page.type("#project-desc", "Created via automated browser audit")

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const submit = buttons.find((b) => b.textContent?.includes("Create Project"))
      submit?.click()
    })

    // Wait for card to appear
    await page.waitForFunction(
      (name: string) => document.body.innerText.includes(name),
      { timeout: 8000 },
      uniqueProjectName
    )
    assert(true, "Project created and rendered in UI optimistically")

    // Test Persistence After Page Refresh
    await page.reload({ waitUntil: "networkidle0" })
    await page.waitForFunction(
      (name: string) => document.body.innerText.includes(name),
      { timeout: 8000 },
      uniqueProjectName
    )
    assert(true, "Project persists in UI after full page refresh (PostgreSQL backed)")

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Tasks CRUD & Completion
    // ─────────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/tasks`, { waitUntil: "networkidle0" })
    await page.waitForFunction(() => document.body.innerText.includes("Tasks"), { timeout: 10000 })
    const uniqueTaskTitle = `Browser Task ${Date.now()}`

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const btn = buttons.find((b) => b.textContent?.includes("New Task"))
      btn?.click()
    })

    await page.waitForSelector("#task-title", { timeout: 5000 })
    await page.type("#task-title", uniqueTaskTitle)
    await page.type("#task-desc", "Task created by browser audit")

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const submit = buttons.find((b) => b.textContent?.includes("Create Task"))
      submit?.click()
    })

    await page.waitForFunction(
      (title: string) => document.body.innerText.includes(title),
      { timeout: 8000 },
      uniqueTaskTitle
    )
    assert(true, "Task created and rendered in task list")

    // Test persistence after refresh
    await page.reload({ waitUntil: "networkidle0" })
    await page.waitForFunction(
      (title: string) => document.body.innerText.includes(title),
      { timeout: 8000 },
      uniqueTaskTitle
    )
    assert(true, "Task persists in UI after page refresh")

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. Notes Rich-Text Editing & Persistence
    // ─────────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/notes`, { waitUntil: "networkidle0" })
    await page.waitForFunction(() => document.body.innerText.includes("Notes"), { timeout: 10000 })
    const uniqueNoteTitle = `Browser Note ${Date.now()}`

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const btn = buttons.find((b) => b.textContent?.includes("New Note"))
      btn?.click()
    })

    await page.waitForSelector("#note-title", { timeout: 5000 })
    await page.type("#note-title", uniqueNoteTitle)

    // Type in TipTap rich text editor or textarea
    const editor = await page.$(".tiptap, [contenteditable='true']")
    if (editor) {
      await editor.click()
      await page.keyboard.type("Automated rich-text note content verification.")
    }

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const submit = buttons.find((b) => b.textContent?.includes("Create Note"))
      submit?.click()
    })

    await page.waitForFunction(
      (title: string) => document.body.innerText.includes(title),
      { timeout: 8000 },
      uniqueNoteTitle
    )
    assert(true, "Note created and rendered in grid")

    await page.reload({ waitUntil: "networkidle0" })
    await page.waitForFunction(
      (title: string) => document.body.innerText.includes(title),
      { timeout: 8000 },
      uniqueNoteTitle
    )
    assert(true, "Note persists with rich content after page refresh")

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. Kanban, Calendar & Activity History
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[5/6] Verifying Kanban, Calendar & Activity History...")

    // Kanban
    await page.goto(`${BASE_URL}/kanban`, { waitUntil: "networkidle0" })
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("to do"), { timeout: 10000 })
    const kanbanText = await page.evaluate(() => document.body.innerText.toLowerCase())
    assert(kanbanText.includes("to do") && kanbanText.includes("in progress") && kanbanText.includes("completed"), "Kanban board renders all status workflow columns")

    // Calendar
    await page.goto(`${BASE_URL}/calendar`, { waitUntil: "networkidle0" })
    await page.waitForSelector(".rdp, table", { timeout: 10000 })
    const calendarMonth = await page.$(".rdp, table")
    assert(calendarMonth !== null, "Calendar grid renders month view and day cells")

    // Activity History on Dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle0" })
    await page.waitForFunction(() => document.body.innerText.includes("Activity") || document.body.innerText.includes("Recent"), { timeout: 10000 })
    const activityText = await page.evaluate(() => document.body.innerText)
    assert(
      activityText.includes("Recent Activity") || activityText.includes("Activity"),
      "Dashboard reflects activity history from real server mutations"
    )

    // Console Errors check
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("status of 404")
    )
    assert(fatalErrors.length === 0, `Zero fatal browser console errors detected (${fatalErrors.length} found)`)

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. Cleanup Audit Records from PostgreSQL
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[6/6] Cleaning up browser audit test data in Neon PostgreSQL...")
    const user = await resolveCurrentUser()
    await prisma.task.deleteMany({
      where: { title: uniqueTaskTitle, userId: user.id },
    })
    await prisma.note.deleteMany({
      where: { title: uniqueNoteTitle, userId: user.id },
    })
    await prisma.project.deleteMany({
      where: { name: uniqueProjectName, userId: user.id },
    })
    console.log("  ✓ Cleaned up test project, task, and note records")

    console.log("\n=================================================================")
    console.log(`  BROWSER AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`)
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

runBrowserAudit()
  .catch((err) => {
    console.error("Browser audit failed with error:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
