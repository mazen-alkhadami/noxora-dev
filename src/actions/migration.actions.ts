"use server"

import { prisma } from "@/lib/prisma"
import { resolveCurrentUser } from "@/lib/auth-context"
import { migrationPayloadSchema } from "@/lib/validations/migration.schema"
import type { ActionResult } from "@/types/actions"
import type { Project, Task, Note, UserPreferences } from "@/types"

export interface MigrationPayload {
  projects: Project[]
  tasks: Task[]
  notes: Note[]
  preferences?: UserPreferences
}

export interface MigrationStatusResponse {
  needsMigration: boolean
  migrationCompletedAt: string | null
  activeStage?: string
  batchIndex?: number
  totalBatches?: number
  error?: string | null
}

export interface MigrationSummary {
  projects: number
  tasks: number
  notes: number
  completedAt: string
}

const BATCH_SIZE = 50

/**
 * Checks whether the current user has already completed migration or has an interrupted migration.
 */
export async function checkMigrationStatusAction(): Promise<ActionResult<MigrationStatusResponse>> {
  try {
    const user = await resolveCurrentUser()
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { migrationCompletedAt: true },
    })

    if (!dbUser) {
      return { success: false, error: "User not found" }
    }

    const latestLog = await prisma.migrationLog.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    const isCompleted = dbUser.migrationCompletedAt !== null

    return {
      success: true,
      data: {
        needsMigration: !isCompleted,
        migrationCompletedAt: dbUser.migrationCompletedAt ? dbUser.migrationCompletedAt.toISOString() : null,
        activeStage: latestLog?.stage,
        batchIndex: latestLog?.batchIndex,
        totalBatches: latestLog?.totalBatches,
        error: latestLog?.status === "FAILED" ? latestLog.error : null,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check migration status"
    return { success: false, error: message }
  }
}

/**
 * Executes an idempotent, chunked migration of client localStorage data into PostgreSQL.
 * All operations are strictly scoped to the server-resolved user.
 */
export async function executeMigrationAction(
  payload: MigrationPayload
): Promise<ActionResult<MigrationSummary>> {
  let createdLogId: string | null = null
  try {
    const user = await resolveCurrentUser()

    // 0. Validate incoming payload against strict schema and limits
    const parseResult = migrationPayloadSchema.safeParse(payload)
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e) => e.message).join(", ")
      return { success: false, error: `Invalid migration payload: ${errorMsg}` }
    }
    const validatedData = parseResult.data

    // 1. Initialize MigrationLog
    const log = await prisma.migrationLog.create({
      data: {
        userId: user.id,
        clientBackupKey: `nexora:backup:${user.id}:${new Date().toISOString()}`,
        stage: "PREFERENCES",
        batchIndex: 0,
        totalBatches: 5,
        projectsCount: validatedData.projects.length,
        tasksCount: validatedData.tasks.length,
        notesCount: validatedData.notes.length,
        status: "IN_PROGRESS",
      },
    })
    createdLogId = log.id

    // 2. Stage 1: Migrate Preferences
    if (validatedData.preferences) {
      await prisma.userPreferences.upsert({
        where: { userId: user.id },
        update: {
          defaultView: validatedData.preferences.defaultView || "dashboard",
          taskDensity: validatedData.preferences.taskDensity || "comfortable",
          confirmBeforeDelete: validatedData.preferences.confirmBeforeDelete ?? true,
        },
        create: {
          userId: user.id,
          defaultView: validatedData.preferences.defaultView || "dashboard",
          taskDensity: validatedData.preferences.taskDensity || "comfortable",
          confirmBeforeDelete: validatedData.preferences.confirmBeforeDelete ?? true,
        },
      })
    }

    await prisma.migrationLog.update({
      where: { id: log.id },
      data: { stage: "PROJECTS", batchIndex: 1 },
    })

    // 3. Stage 2: Migrate Projects in chunks of BATCH_SIZE
    // Safe guard: Do not silently overwrite newer database records with stale local data
    for (let i = 0; i < validatedData.projects.length; i += BATCH_SIZE) {
      const chunk = validatedData.projects.slice(i, i + BATCH_SIZE)
      await prisma.$transaction(async (tx) => {
        for (const p of chunk) {
          const existing = await tx.project.findUnique({
            where: { id_userId: { id: p.id, userId: user.id } },
            select: { updatedAt: true },
          })

          const localUpdatedAt = p.updatedAt ? new Date(p.updatedAt) : new Date(0)

          if (existing) {
            // Only update if local copy has a strictly newer timestamp than existing database record
            if (localUpdatedAt > existing.updatedAt) {
              await tx.project.update({
                where: { id_userId: { id: p.id, userId: user.id } },
                data: {
                  name: p.name,
                  description: p.description || "",
                  status: p.status,
                  color: p.color || "#6366f1",
                  updatedAt: localUpdatedAt,
                },
              })
            }
          } else {
            await tx.project.create({
              data: {
                id: p.id,
                userId: user.id,
                name: p.name,
                description: p.description || "",
                status: p.status,
                color: p.color || "#6366f1",
                createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
                updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
              },
            })
          }
        }
      })
    }

    await prisma.migrationLog.update({
      where: { id: log.id },
      data: { stage: "TASKS", batchIndex: 2 },
    })

    // 4. Stage 3: Migrate Tasks in chunks of BATCH_SIZE
    for (let i = 0; i < validatedData.tasks.length; i += BATCH_SIZE) {
      const chunk = validatedData.tasks.slice(i, i + BATCH_SIZE)
      await prisma.$transaction(async (tx) => {
        for (let j = 0; j < chunk.length; j++) {
          const t = chunk[j]
          if (!t) continue

          // Validate that if task links to a project, project belongs to this user
          let validProjectId: string | null = null
          if (t.projectId) {
            const projectExists = await tx.project.findUnique({
              where: { id_userId: { id: t.projectId, userId: user.id } },
              select: { id: true },
            })
            if (projectExists) {
              validProjectId = t.projectId
            }
          }

          const dueDate = t.dueDate ? new Date(`${t.dueDate.slice(0, 10)}T00:00:00.000Z`) : null
          const order = (i + j + 1) * 1000.0

          const existing = await tx.task.findUnique({
            where: { id_userId: { id: t.id, userId: user.id } },
            select: { updatedAt: true },
          })

          const localUpdatedAt = t.updatedAt ? new Date(t.updatedAt) : new Date(0)

          if (existing) {
            if (localUpdatedAt > existing.updatedAt) {
              await tx.task.update({
                where: { id_userId: { id: t.id, userId: user.id } },
                data: {
                  title: t.title,
                  description: t.description || "",
                  status: t.status,
                  priority: t.priority,
                  dueDate,
                  projectId: validProjectId,
                  order: typeof t.order === "number" ? t.order : order,
                  updatedAt: localUpdatedAt,
                },
              })
            }
          } else {
            await tx.task.create({
              data: {
                id: t.id,
                userId: user.id,
                projectId: validProjectId,
                title: t.title,
                description: t.description || "",
                status: t.status,
                priority: t.priority,
                dueDate,
                order: typeof t.order === "number" ? t.order : order,
                createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
                updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
              },
            })
          }
        }
      })
    }

    await prisma.migrationLog.update({
      where: { id: log.id },
      data: { stage: "NOTES", batchIndex: 3 },
    })

    // 5. Stage 4: Migrate Notes in chunks of BATCH_SIZE
    for (let i = 0; i < validatedData.notes.length; i += BATCH_SIZE) {
      const chunk = validatedData.notes.slice(i, i + BATCH_SIZE)
      await prisma.$transaction(async (tx) => {
        for (const n of chunk) {
          let validProjectId: string | null = null
          if (n.projectId) {
            const projectExists = await tx.project.findUnique({
              where: { id_userId: { id: n.projectId, userId: user.id } },
              select: { id: true },
            })
            if (projectExists) {
              validProjectId = n.projectId
            }
          }

          const existing = await tx.note.findUnique({
            where: { id_userId: { id: n.id, userId: user.id } },
            select: { updatedAt: true },
          })

          const localUpdatedAt = n.updatedAt ? new Date(n.updatedAt) : new Date(0)

          if (existing) {
            if (localUpdatedAt > existing.updatedAt) {
              await tx.note.update({
                where: { id_userId: { id: n.id, userId: user.id } },
                data: {
                  title: n.title,
                  content: n.content || "",
                  projectId: validProjectId,
                  updatedAt: localUpdatedAt,
                },
              })
            }
          } else {
            await tx.note.create({
              data: {
                id: n.id,
                userId: user.id,
                projectId: validProjectId,
                title: n.title,
                content: n.content || "",
                createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
                updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date(),
              },
            })
          }
        }
      })
    }

    // 6. Stage 5: Finalization & Timestamp Stamp on User
    const completionDate = new Date()
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { migrationCompletedAt: completionDate },
      })

      await tx.migrationLog.update({
        where: { id: log.id },
        data: {
          stage: "COMPLETED",
          batchIndex: 5,
          status: "COMPLETED",
        },
      })
    })

    return {
      success: true,
      data: {
        projects: validatedData.projects.length,
        tasks: validatedData.tasks.length,
        notes: validatedData.notes.length,
        completedAt: completionDate.toISOString(),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed"
    if (createdLogId) {
      try {
        await prisma.migrationLog.update({
          where: { id: createdLogId },
          data: {
            status: "FAILED",
            error: message,
          },
        })
      } catch {
        // Ignore secondary log update error
      }
    }
    return { success: false, error: message }
  }
}
