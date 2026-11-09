/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())

import http from "http"
import { spawn, type ChildProcess } from "child_process"
import puppeteer, { type Browser, type Page } from "puppeteer-core"
import { prisma } from "../src/lib/prisma"

const PORT = 3456
const BASE_URL = `http://127.0.0.1:${PORT}`
const CHROME_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

const VIEWPORTS = [
  { name: "Mobile Compact (iPhone SE)", width: 375, height: 667, isMobile: true },
  { name: "Mobile Modern (iPhone 14)",  width: 390, height: 844, isMobile: true },
  { name: "Tablet (iPad Mini)",         width: 768, height: 1024, isMobile: true },
  { name: "Desktop (Laptop / 1024px)",  width: 1024, height: 768, isMobile: false },
  { name: "Large Desktop (1440px)",     width: 1440, height: 900, isMobile: false },
]

const ROUTES = [
  "/dashboard",
  "/projects",
  "/tasks",
  "/kanban",
  "/calendar",
  "/notes",
  "/settings",
]

function waitForServer(url: string, timeoutMs = 45000): Promise<void> {
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

async function runResponsiveAudit() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Phase 7: Responsive Design & Viewport Audit     ")
  console.log("=================================================================\n")

  let serverProcess: ChildProcess | null = null
  let browser: Browser | null = null
  let passedCount = 0
  let failedCount = 0

  const testEmail = `responsive_audit_${Date.now()}@nexora.dev`
  const testPassword = "AuditUser2026!"

  function pass(msg: string) {
    passedCount++
    console.log(`  ✓ PASS: ${msg}`)
  }

  function fail(msg: string, err?: any) {
    failedCount++
    console.error(`  ✗ FAIL: ${msg}`, err ? err.message || err : "")
  }

  try {
    console.log("[1/4] Starting Next.js server on port", PORT)
    serverProcess = spawn("cmd.exe", ["/c", `npx next start -H 127.0.0.1 -p ${PORT}`], {
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

    await waitForServer(`${BASE_URL}/login`)
    console.log("  ✓ Next.js server ready at", BASE_URL)

    console.log("[2/4] Launching headless browser...")
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })
    const page: Page = await browser.newPage()

    console.log("[3/4] Creating and authenticating session...")
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle0" })
    await page.type("#name", "Responsive Auditor")
    await page.type("#email", testEmail)
    await page.type("#password", testPassword)
    await page.type("#confirmPassword", testPassword)

    await Promise.all([
      Promise.race([
        page.waitForNavigation({ waitUntil: "networkidle0", timeout: 25000 }),
        page.waitForSelector("[role='alert']", { timeout: 25000 }).then(async (el: any) => {
          if (el) {
            const txt = await el.evaluate((node: any) => node.textContent)
            throw new Error(`Registration failed: ${txt}`)
          }
        }),
      ]),
      page.click("button[type='submit']"),
    ])
    console.log("  ✓ Authenticated and on dashboard\n")

    console.log("[4/4] Auditing viewports across all routes...")

    for (const vp of VIEWPORTS) {
      console.log(`\n── Viewport: ${vp.name} (${vp.width}x${vp.height}) ──`)
      await page.setViewport({ width: vp.width, height: vp.height })

      for (const route of ROUTES) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle0" })

        // Check 1: Root container has no unintended horizontal overflow
        const overflow = await page.evaluate(() => {
          const body = document.body
          const docEl = document.documentElement
          const scrollWidth = Math.max(body.scrollWidth, docEl.scrollWidth)
          const clientWidth = docEl.clientWidth
          return {
            scrollWidth,
            clientWidth,
            hasOverflow: scrollWidth > clientWidth + 1, // allow 1px rounding margin
          }
        })

        if (!overflow.hasOverflow) {
          pass(`${route} layout fits viewport without horizontal body overflow (${overflow.scrollWidth}px <= ${overflow.clientWidth}px)`)
        } else {
          fail(`${route} has body overflow: scrollWidth=${overflow.scrollWidth}px > clientWidth=${overflow.clientWidth}px`)
        }

        // Check 2: Navigation controls match viewport density
        if (vp.isMobile) {
          // On mobile, hamburger button should be rendered in topbar
          const hamburger = await page.$("button[aria-label='Open navigation menu']")
          if (hamburger) {
            pass(`${route} mobile hamburger button is present and accessible`)
          } else {
            fail(`${route} missing mobile hamburger menu`)
          }
        } else {
          // On desktop, sidebar navigation should be rendered
          const sidebar = await page.$("aside")
          if (sidebar) {
            pass(`${route} desktop sidebar is present and rendered`)
          } else {
            fail(`${route} missing desktop sidebar`)
          }
        }
      }
    }

    console.log("\n=================================================================")
    console.log(`  RESPONSIVE AUDIT COMPLETE: ${passedCount} PASSED / ${failedCount} FAILED`)
    console.log("=================================================================\n")

    if (failedCount > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error("Fatal error during responsive audit:", err)
    process.exit(1)
  } finally {
    if (browser) await browser.close()
    if (serverProcess) {
      serverProcess.kill("SIGTERM")
    }
    // Clean up test auditor user
    try {
      await prisma.user.deleteMany({ where: { email: testEmail } })
    } catch {
      // ignore
    }
  }
}

runResponsiveAudit()
