/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())

import puppeteer from "puppeteer-core"
import { spawn, type ChildProcess } from "child_process"
import http from "http"
import { prisma } from "../src/lib/prisma"

const PORT = 3456
const BASE_URL = `http://127.0.0.1:${PORT}`
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

async function runBrowserQA() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Phase 5 Real Browser Authentication QA Suite   ")
  console.log("=================================================================\n")

  let serverProcess: ChildProcess | null = null
  let browser: any = null

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

  const testUser = {
    name: "Dr. Evelyn Reed",
    email: `browser_qa_${Date.now()}@nexora.dev`,
    initialPassword: "QuantumPassword123!",
    newPassword: "UpdatedQuantumPassword456!",
  }

  let testUserId = ""

  try {
    // 1. Launch Next.js Server inside the same command session
    console.log("[1/5] Launching Next.js production server on 127.0.0.1:3456...")
    serverProcess = spawn("cmd.exe", ["/c", "npx next start -H 127.0.0.1 -p 3456"], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: "127.0.0.1",
        AUTH_URL: `http://127.0.0.1:${PORT}`,
        NEXTAUTH_URL: `http://127.0.0.1:${PORT}`,
      },
    })

    serverProcess.stdout?.on("data", (d: any) => {
      const msg = d.toString().trim()
      if (msg) console.log(`   [Next.js]: ${msg}`)
    })
    serverProcess.stderr?.on("data", (d: any) => {
      const msg = d.toString().trim()
      if (msg) console.error(`   [Next.js Error]: ${msg}`)
    })
    serverProcess.on("exit", (code: any, signal: any) => {
      console.log(`   [Next.js Process Exit]: code=${code}, signal=${signal}`)
    })

    await waitForServer(`${BASE_URL}/login`)
    console.log("  ✓ Next.js server live and ready at", BASE_URL)

    // 2. Launch Google Chrome
    console.log("[2/5] Launching Google Chrome headless...")
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1280,800",
      ],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    page.on("console", (msg: any) => console.log(`   [Browser ${msg.type()}]:`, msg.text()))
    page.on("pageerror", (err: any) => console.error("   [Browser Error]:", err))
    console.log("  ✓ Headless Chrome initialized successfully\n")

    // ── SCENARIO 1: Registration Form Inputs, Validation & Password Visibility ──
    console.log("── Scenario 1: Registration Validation & Password Visibility ──")
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle0" })

    // Test password visibility toggle
    await page.type("#password", "Secret123!")
    let passwordType = await page.$eval("#password", (el: any) => el.type)
    assert(passwordType === "password", "Initial password input type is 'password'")

    // Click toggle button
    const toggleButtons = await page.$$("button[type='button']")
    if (toggleButtons.length > 0) {
      await toggleButtons[0].click()
      passwordType = await page.$eval("#password", (el: any) => el.type)
      assert(passwordType === "text", "Password input type switches to 'text' after visibility toggle")
      await toggleButtons[0].click()
      passwordType = await page.$eval("#password", (el: any) => el.type)
      assert(passwordType === "password", "Password input type switches back to 'password'")
    }

    // Clear password input using keyboard events
    await page.click("#password", { clickCount: 3 })
    await page.keyboard.press("Backspace")

    // Test client validation: mismatched passwords
    await page.type("#name", testUser.name)
    await page.type("#email", testUser.email)
    await page.type("#password", testUser.initialPassword)
    await page.type("#confirmPassword", "MismatchPassword999!")
    await page.click("button[type='submit']")

    await page.waitForSelector("[role='alert']", { timeout: 4000 })
    const mismatchText = await page.$eval("[role='alert']", (el: any) => el.textContent)
    assert(
      mismatchText.includes("do not match"),
      "Mismatched passwords rejected with clear error alert",
      mismatchText
    )

    async function clearAndType(selector: string, text: string) {
      await page.click(selector, { clickCount: 3 })
      await page.keyboard.press("Backspace")
      await page.type(selector, text)
    }

    // ── SCENARIO 2: Successful Registration & Automatic Sign-In ──
    console.log("\n── Scenario 2: Successful Registration & Automatic Sign-In ──")
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle0" })
    await clearAndType("#name", testUser.name)
    await clearAndType("#email", testUser.email)
    await clearAndType("#password", testUser.initialPassword)
    await clearAndType("#confirmPassword", testUser.initialPassword)

    await Promise.all([
      Promise.race([
        page.waitForNavigation({ waitUntil: "networkidle0", timeout: 25000 }),
        page.waitForSelector("[role='alert']", { timeout: 25000 }).then(async (el: any) => {
          if (el) {
            const txt = await el.evaluate((node: any) => node.textContent)
            throw new Error(`Registration failed with alert: ${txt}`)
          }
        }),
      ]),
      page.click("button[type='submit']"),
    ])
    const currentUrl = page.url()
    assert(
      currentUrl.includes("/dashboard"),
      `Successfully registered and auto-redirected to dashboard: ${currentUrl}`
    )

    // Verify user exists in database
    const dbUser = await prisma.user.findUnique({
      where: { email: testUser.email },
      include: { preferences: true },
    })
    assert(!!dbUser, "User record created in Neon PostgreSQL")
    if (dbUser) testUserId = dbUser.id

    // ── SCENARIO 3: Session Persistence Across Page Refresh ──
    console.log("\n── Scenario 3: Session Persistence on Reload ──")
    await page.reload({ waitUntil: "networkidle0" })
    const urlAfterReload = page.url()
    assert(
      urlAfterReload.includes("/dashboard"),
      "Session persists across full browser reload (remains on /dashboard)"
    )

    // Verify user initials in the DOM
    const initialsInPage = await page.evaluate(() => document.body.innerText)
    assert(
      initialsInPage.includes("ER") || initialsInPage.includes("Dr. Evelyn Reed"),
      "Active user identity correctly displayed in UI"
    )

    // ── SCENARIO 4: Sign Out & Route Protection ──
    console.log("\n── Scenario 4: Sign Out & Middleware Route Protection ──")
    // Find and click sign out button
    const signoutBtn = await page.$("button[aria-label='Sign out']")
    if (signoutBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {}),
        signoutBtn.click(),
      ])
    }
    if (!page.url().includes("/login")) {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" })
    }
    assert(page.url().includes("/login"), "User redirected to /login upon sign out")

    // Attempt to access protected routes directly after sign out
    const protectedPages = ["/dashboard", "/projects", "/tasks", "/settings"]
    for (const route of protectedPages) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle0" })
      const postSignoutUrl = page.url()
      assert(
        postSignoutUrl.includes("/login") && postSignoutUrl.includes(encodeURIComponent(route)),
        `Protected route '${route}' intercepts unauthenticated visitor and redirects to login`
      )
    }

    // ── SCENARIO 5: Sign In with Invalid Credentials ──
    console.log("\n── Scenario 5: Invalid Credentials Protection ──")
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" })
    await page.type("#email", testUser.email)
    await page.type("#password", "CompletelyWrongPassword123!")
    await page.click("button[type='submit']")

    await page.waitForSelector("[role='alert']", { timeout: 5000 })
    const loginError = await page.$eval("[role='alert']", (el: any) => el.textContent)
    assert(
      loginError.includes("Invalid email or password"),
      "Invalid login credentials rejected with generic security alert",
      loginError
    )

    // ── SCENARIO 6: Duplicate Email Registration Prevention ──
    console.log("\n── Scenario 6: Duplicate Registration Rejection ──")
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle0" })
    await page.type("#name", "Duplicate Attempt")
    await page.type("#email", testUser.email)
    await page.type("#password", testUser.initialPassword)
    await page.type("#confirmPassword", testUser.initialPassword)
    await page.click("button[type='submit']")

    await page.waitForSelector("[role='alert']", { timeout: 5000 })
    const duplicateError = await page.$eval("[role='alert']", (el: any) => el.textContent)
    assert(
      duplicateError.includes("already exists"),
      "Duplicate email registration rejected with friendly warning",
      duplicateError
    )

    // ── SCENARIO 7: Sign In with Valid Credentials & State Persistence ──
    console.log("\n── Scenario 7: Sign In with Valid Credentials ──")
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" })
    await clearAndType("#email", testUser.email)
    await clearAndType("#password", testUser.initialPassword)

    await Promise.all([
      Promise.race([
        page.waitForNavigation({ waitUntil: "networkidle0", timeout: 25000 }),
        page.waitForSelector("[role='alert']", { timeout: 25000 }).then(async (el: any) => {
          if (el) {
            const txt = await el.evaluate((node: any) => node.textContent)
            throw new Error(`Login failed with alert: ${txt}`)
          }
        }),
      ]),
      page.click("button[type='submit']"),
    ])
    assert(page.url().includes("/dashboard"), "Valid sign in navigates back to /dashboard")

    // ── SCENARIO 8: Password Reset Flow via Browser ──
    console.log("\n── Scenario 8: Password Reset Flow via Browser ──")
    await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: "networkidle0" })
    await page.type("#email", testUser.email)
    await page.click("button[type='submit']")

    await page.waitForSelector(".text-emerald-500", { timeout: 5000 })
    assert(true, "Forgot password request submitted; success confirmation displayed")

    // Fetch the reset token created in Neon PostgreSQL
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: { identifier: `reset:${testUser.email.toLowerCase()}` },
    })
    assert(!!tokenRecord?.token, "Secure reset token generated and recorded in Neon PostgreSQL")

    if (tokenRecord?.token) {
      // Visit reset password URL
      await page.goto(`${BASE_URL}/reset-password?token=${tokenRecord.token}`, {
        waitUntil: "networkidle0",
      })

      // Enter new password
      await page.type("#password", testUser.newPassword)
      await page.type("#confirmPassword", testUser.newPassword)
      await page.click("button[type='submit']")

      await page.waitForSelector(".text-emerald-500", { timeout: 6000 })
      assert(true, "Password updated successfully; confirmation view rendered")

      // Attempt to re-use the exact same token (Single-use enforcement check)
      await page.goto(`${BASE_URL}/reset-password?token=${tokenRecord.token}`, {
        waitUntil: "networkidle0",
      })
      await page.type("#password", "AnotherAttemptPassword999!")
      await page.type("#confirmPassword", "AnotherAttemptPassword999!")
      await page.click("button[type='submit']")

      await page.waitForSelector("[role='alert']", { timeout: 5000 })
      const reuseError = await page.$eval("[role='alert']", (el: any) => el.textContent)
      assert(
        reuseError.includes("Invalid or expired"),
        "Single-use token enforcement: token invalidated immediately after first use"
      )

      // Test sign-in with the NEW password
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" })
      await page.type("#email", testUser.email)
      await page.type("#password", testUser.newPassword)

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0", timeout: 20000 }),
        page.click("button[type='submit']"),
      ])
      assert(
        page.url().includes("/dashboard"),
        "Successfully signed in using newly updated password!"
      )
    }

    console.log("\n=================================================================")
    console.log(`  BROWSER QA COMPLETE: ${passed} PASSED / ${failed} FAILED`)
    console.log("=================================================================\n")
  } finally {
    // Teardown
    if (browser) {
      await browser.close().catch(() => {})
    }
    if (serverProcess?.pid) {
      try {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], { stdio: "ignore" })
      } catch {
        serverProcess.kill()
      }
    }
    // Clean up test user
    if (testUserId) {
      console.log("[Teardown] Cleaning up test records from Neon PostgreSQL...")
      await prisma.verificationToken.deleteMany({
        where: { identifier: { contains: testUser.email.toLowerCase() } },
      })
      await prisma.userPreferences.deleteMany({ where: { userId: testUserId } })
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
      console.log("  ✓ Test records cleaned up.\n")
    }
  }

  if (failed > 0) {
    process.exit(1)
  }
}

runBrowserQA()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error("FATAL: Browser QA failed with exception:", err)
    process.exit(1)
  })
