/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())

import http from "http"
import { spawn, type ChildProcess } from "child_process"

const PORT = 3456
const BASE_URL = `http://127.0.0.1:${PORT}`

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

async function runRouteVerification() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Phase 5: Middleware & HTTP Route Protection    ")
  console.log("=================================================================\n")

  let serverProcess: ChildProcess | null = null

  try {
    console.log(`Starting Next.js server on 127.0.0.1:${PORT}...`)
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
    console.log("Server ready. Running route verification...\n")
  } catch (err) {
    console.error("Failed to start server:", err)
    if (serverProcess?.pid) {
      try {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], { stdio: "ignore" })
      } catch {
        serverProcess.kill()
      }
    }
    process.exit(1)
  }

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

  // Helper to fetch with redirect: "manual" so we can inspect redirect location and status code
  async function fetchManual(url: string) {
    return await fetch(url, { redirect: "manual" })
  }

  const protectedRoutes = [
    "/dashboard",
    "/projects",
    "/tasks",
    "/kanban",
    "/calendar",
    "/notes",
    "/settings",
  ]

  console.log("── 1. Unauthenticated Protected Route Redirection (Middleware) ──")
  for (const route of protectedRoutes) {
    const res = await fetchManual(`${BASE_URL}${route}`)
    const isRedirect = res.status === 307 || res.status === 308 || res.status === 302
    const location = res.headers.get("location") || ""
    const expectedRedirect = `/login?callbackUrl=${encodeURIComponent(route)}`
    const matchesTarget = location.includes("/login") && location.includes(encodeURIComponent(route))

    assert(
      isRedirect && matchesTarget,
      `Unauthenticated '${route}' redirected to '${expectedRedirect}' (status: ${res.status})`,
      `location header was '${location}'`
    )
  }

  console.log("\n── 2. Public Route Accessibility ──")

  const loginRes = await fetchManual(`${BASE_URL}/login`)
  assert(loginRes.status === 200, `/login page accessible to public (status: ${loginRes.status})`)

  const registerRes = await fetchManual(`${BASE_URL}/register`)
  assert(registerRes.status === 200, `/register page accessible to public (status: ${registerRes.status})`)

  const landingRes = await fetchManual(`${BASE_URL}/`)
  const landingLocation = landingRes.headers.get("location") || ""
  assert(
    (landingRes.status === 307 || landingRes.status === 302) && landingLocation.includes("/login"),
    `/ root redirects unauthenticated visitor to /login (status: ${landingRes.status})`
  )

  console.log("\n── 3. NextAuth Providers API Endpoint ──")

  const providersRes = await fetch(`${BASE_URL}/api/auth/providers`)
  assert(providersRes.status === 200, `/api/auth/providers responded 200 OK`)
  const providersData = await providersRes.json()
  assert(!!providersData.credentials, "Credentials provider is configured and available")

  if (serverProcess?.pid) {
    try {
      spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], { stdio: "ignore" })
    } catch {
      serverProcess.kill()
    }
  }

  console.log("\n=================================================================")
  console.log(`  ROUTE VERIFICATION COMPLETE: ${passed} PASSED / ${failed} FAILED`)
  console.log("=================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runRouteVerification().catch((err) => {
  console.error("Route verification fatal error:", err)
  process.exit(1)
})
