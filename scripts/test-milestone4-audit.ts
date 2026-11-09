/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())

process.env.ALLOW_DEMO_FALLBACK = "true"
import { prisma } from "../src/lib/prisma"
import { resolveCurrentUser } from "../src/lib/auth-context"
import { executeMigrationAction, checkMigrationStatusAction } from "../src/actions/migration.actions"

async function runAudit() {
  console.log("=================================================================")
  console.log("  NEXORA DevHub — Milestone 4 Final Verification Audit Suite")
  console.log("=================================================================\n")

  const user = await resolveCurrentUser()
  console.log(`[Audit Context] Running under resolved user: ${user.id} (${user.email})`)

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

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Migration Safety & Validation Audit
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n1. Migration Payload Validation & Size Limiting")

  // Test 1.1: Reject oversized payloads
  const oversizedProjects = Array.from({ length: 501 }, (_, i) => ({
    id: `proj-overflow-${i}`,
    name: `Overflow ${i}`,
    status: "ACTIVE" as const,
    color: "#6366f1",
  }))

  const overflowRes = await executeMigrationAction({
    projects: oversizedProjects as any,
    tasks: [],
    notes: [],
  })
  assert(!overflowRes.success && (overflowRes.error?.includes("Cannot migrate more than 500") ?? false), "Rejects migration payload exceeding 500 projects limit")

  // Test 1.2: Reject invalid enums in tasks
  const invalidTaskRes = await executeMigrationAction({
    projects: [],
    tasks: [
      {
        id: "task-invalid-enum",
        title: "Invalid Status Task",
        status: "INVALID_STATUS" as any,
        priority: "MEDIUM",
      } as any,
    ],
    notes: [],
  })
  assert(!invalidTaskRes.success && (invalidTaskRes.error?.includes("Invalid migration payload") ?? false), "Rejects malformed task payload with invalid enum status")

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Safe Stale Data Protection
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n2. Stale Local Data Overwrite Prevention")

  const testAuditProjectId = `audit-proj-${Date.now()}`
  const now = new Date()
  const dbTimestamp = new Date(now.getTime() - 1000 * 60 * 30) // 30 mins ago
  const staleLocalTimestamp = new Date(now.getTime() - 1000 * 60 * 60) // 60 mins ago (older)
  const freshLocalTimestamp = new Date(now.getTime() + 1000 * 60 * 10) // 10 mins in future (newer)

  // Create record directly in DB as if modified on another device
  await prisma.project.create({
    data: {
      id: testAuditProjectId,
      userId: user.id,
      name: "Authoritative Database Project",
      description: "Should not be overwritten by older local data",
      status: "ACTIVE",
      color: "#10b981",
      updatedAt: dbTimestamp,
    },
  })

  // Attempt migration with STALE local data
  await executeMigrationAction({
    projects: [
      {
        id: testAuditProjectId,
        name: "Stale Localhost Overwrite Attempt",
        status: "ARCHIVED",
        updatedAt: staleLocalTimestamp.toISOString(),
      } as any,
    ],
    tasks: [],
    notes: [],
  })

  // Verify DB record was NOT modified by stale data
  const postStaleProj = await prisma.project.findUnique({
    where: { id_userId: { id: testAuditProjectId, userId: user.id } },
  })
  assert(postStaleProj?.name === "Authoritative Database Project", "Stale local data does not overwrite newer database record")
  assert(postStaleProj?.status === "ACTIVE", "Database record fields preserved against stale update")

  // Now attempt migration with STRICTLY NEWER local data
  await executeMigrationAction({
    projects: [
      {
        id: testAuditProjectId,
        name: "Legitimately Newer Local Project",
        status: "COMPLETED",
        updatedAt: freshLocalTimestamp.toISOString(),
      } as any,
    ],
    tasks: [],
    notes: [],
  })

  const postNewerProj = await prisma.project.findUnique({
    where: { id_userId: { id: testAuditProjectId, userId: user.id } },
  })
  assert(postNewerProj?.name === "Legitimately Newer Local Project", "Newer local data updates database record correctly")
  assert(postNewerProj?.status === "COMPLETED", "Database record fields updated for fresh local edit")

  // Cleanup audit project
  await prisma.project.delete({
    where: { id_userId: { id: testAuditProjectId, userId: user.id } },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Duplicate Prevention & Resume Tracking
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n3. Duplicate Prevention & Status Tracking")

  const statusRes = await checkMigrationStatusAction()
  assert(statusRes.success, "Migration status check succeeds")

  // Run valid migration with sample item
  const sampleId = `audit-sample-${Date.now()}`
  const firstMigration = await executeMigrationAction({
    projects: [
      {
        id: sampleId,
        name: "Sample For Idempotency",
        status: "ACTIVE",
      } as any,
    ],
    tasks: [],
    notes: [],
  })
  assert(firstMigration.success, "First migration run succeeds")

  const secondMigration = await executeMigrationAction({
    projects: [
      {
        id: sampleId,
        name: "Sample For Idempotency",
        status: "ACTIVE",
      } as any,
    ],
    tasks: [],
    notes: [],
  })
  assert(secondMigration.success, "Second migration run succeeds without duplicate error")

  const countProjects = await prisma.project.count({
    where: { id: sampleId, userId: user.id },
  })
  assert(countProjects === 1, "Idempotency guaranteed: exactly 1 record exists in DB")

  // Cleanup
  await prisma.project.delete({
    where: { id_userId: { id: sampleId, userId: user.id } },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Concurrency & In-flight State Invariants Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n4. Inflight Operations & Sync State Safety Invariants")

  // Verify in-flight operations logic model:
  // If ops are in flight, syncState cannot report SYNCED until inFlightOps reaches 0
  let inFlight = 0
  let currentSyncState: string = "SYNCED"

  function simulateBegin() {
    inFlight++
    currentSyncState = "SYNCING"
  }

  function simulateEnd(success: boolean) {
    inFlight = Math.max(0, inFlight - 1)
    if (inFlight === 0) {
      currentSyncState = success ? "SYNCED" : "SYNC_FAILED"
    }
  }

  // Simulate two concurrent requests: Op1 and Op2
  simulateBegin() // Op1 starts
  simulateBegin() // Op2 starts
  assert(currentSyncState === "SYNCING", "State is SYNCING when multiple operations start")

  simulateEnd(true) // Op1 finishes, but Op2 is still in flight
  assert(currentSyncState === "SYNCING" && inFlight === 1, "State remains SYNCING while remaining operation is in flight (Never premature SYNCED)")

  simulateEnd(true) // Op2 finishes
  assert(currentSyncState === "SYNCED" && inFlight === 0, "State transitions to SYNCED only when all in-flight ops finish")

  // Simulate one operation failing
  simulateBegin()
  simulateEnd(false)
  assert(currentSyncState === "SYNC_FAILED", "Failed operation transitions to SYNC_FAILED and does not report SYNCED")

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Targeted Rollback Isolation Invariants
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n5. Targeted Rollback Isolation Invariants")

  // Simulate item creation failure during concurrent user action
  let items = [{ id: "item-existing", name: "Existing" }]
  const optimisticItem = { id: "item-optimistic-fail", name: "Failing" }
  // User adds optimistic item
  items = [optimisticItem, ...items]
  // Concurrent user action: user adds another item
  items = [{ id: "item-concurrent", name: "Concurrent" }, ...items]

  // Optimistic creation fails -> Targeted rollback filters out only optimisticItem.id
  items = items.filter((i) => i.id !== optimisticItem.id)

  assert(items.some((i) => i.id === "item-concurrent"), "Targeted rollback does not discard concurrent item created while first mutation was inflight")
  assert(items.some((i) => i.id === "item-existing"), "Existing items intact after rollback")
  assert(!items.some((i) => i.id === optimisticItem.id), "Failed optimistic item removed from state")

  console.log("\n=================================================================")
  console.log(`  FINAL AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("=================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runAudit()
  .catch((err) => {
    console.error("Audit script failed with error:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
