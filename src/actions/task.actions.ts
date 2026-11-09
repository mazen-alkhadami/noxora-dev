"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { resolveCurrentUser } from "@/lib/auth-context"
import { recordActivity } from "@/lib/services/activity.service"
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/validations/task.schema"
import {
  moveTaskSchema,
  reorderTaskSchema,
  type MoveTaskInput,
  type ReorderTaskInput,
} from "@/lib/validations/kanban.schema"
import {
  calculateMidpointOrder,
  isCompressionDetected,
  rebalanceColumnOrders,
  KANBAN_SPACING,
} from "@/lib/services/kanban.service"
import { verifyProjectOwnership } from "@/lib/services/ownership.service"
import type { ActionResult } from "@/types/actions"
import type { Task, TaskStatus } from "@/types"

export interface SerializedTask extends Task {
  order: number
}

function serializeTask(t: {
  id: string
  userId: string
  projectId: string | null
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: Date | null
  order: number
  createdAt: Date
  updatedAt: Date
}): SerializedTask {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description || "",
    status: t.status as TaskStatus,
    priority: t.priority as Task["priority"],
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    order: t.order,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export async function getTasksAction(): Promise<ActionResult<SerializedTask[]>> {
  try {
    const user = await resolveCurrentUser()
    const tasks = await prisma.task.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    })

    return {
      success: true,
      data: tasks.map(serializeTask),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tasks"
    return { success: false, error: message }
  }
}

export async function createTaskAction(
  rawInput: CreateTaskInput
): Promise<ActionResult<SerializedTask>> {
  try {
    const user = await resolveCurrentUser()
    const parsed = createTaskSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    const { title, description, status, priority, dueDate, projectId } = parsed.data

    // Validate Project Ownership
    if (projectId) {
      const isOwner = await verifyProjectOwnership(user.id, projectId)
      if (!isOwner) {
        return { success: false, error: "Referenced project not found or access denied" }
      }
    }

    // Determine initial order at column tail
    const lastTask = await prisma.task.findFirst({
      where: { userId: user.id, status },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const order = lastTask ? lastTask.order + KANBAN_SPACING : KANBAN_SPACING

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        projectId: projectId || null,
        title,
        description: description || "",
        status,
        priority,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
        order,
      },
    })

    // Log Activity
    await recordActivity(
      user.id,
      "task_created",
      `Added task "${task.title}"`,
      { taskId: task.id, status: task.status }
    )

    return {
      success: true,
      data: serializeTask(task),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task"
    return { success: false, error: message }
  }
}

export async function updateTaskAction(
  id: string,
  rawInput: UpdateTaskInput
): Promise<ActionResult<SerializedTask>> {
  try {
    const user = await resolveCurrentUser()

    if (!id || typeof id !== "string") {
      return { success: false, error: "Task ID is required" }
    }

    const parsed = updateTaskSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    // Validate Project Ownership if being modified
    if (parsed.data.projectId !== undefined && parsed.data.projectId !== null) {
      const isOwner = await verifyProjectOwnership(user.id, parsed.data.projectId)
      if (!isOwner) {
        return { success: false, error: "Referenced project not found or access denied" }
      }
    }

    const updateData: Prisma.TaskUpdateInput = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority
    if (parsed.data.order !== undefined) updateData.order = parsed.data.order
    if (parsed.data.projectId !== undefined) {
      if (parsed.data.projectId === null) {
        updateData.project = { disconnect: true }
      } else {
        updateData.project = { connect: { id: parsed.data.projectId } }
      }
    }

    if (parsed.data.dueDate !== undefined) {
      updateData.dueDate = parsed.data.dueDate
        ? new Date(`${parsed.data.dueDate}T00:00:00.000Z`)
        : null
    }

    // Atomic tenant-isolated update via compound key
    const task = await prisma.task.update({
      where: {
        id_userId: {
          id,
          userId: user.id,
        },
      },
      data: updateData,
    })

    // Log Activity
    const activityType =
      parsed.data.status === "COMPLETED" ? "task_completed" : "task_updated"
    await recordActivity(
      user.id,
      activityType,
      `Updated task "${task.title}"`,
      { taskId: task.id, status: task.status }
    )

    return {
      success: true,
      data: serializeTask(task),
    }
  } catch {
    return {
      success: false,
      error: "Task not found or access denied",
    }
  }
}

export async function deleteTaskAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await resolveCurrentUser()

    if (!id || typeof id !== "string") {
      return { success: false, error: "Task ID is required" }
    }

    const existing = await prisma.task.findUnique({
      where: {
        id_userId: {
          id,
          userId: user.id,
        },
      },
      select: { title: true },
    })

    if (!existing) {
      return { success: false, error: "Task not found or access denied" }
    }

    await prisma.task.delete({
      where: {
        id_userId: {
          id,
          userId: user.id,
        },
      },
    })

    // Log Activity
    await recordActivity(
      user.id,
      "task_deleted",
      `Deleted task "${existing.title}"`,
      { taskId: id }
    )

    return {
      success: true,
      data: { id },
    }
  } catch {
    return {
      success: false,
      error: "Failed to delete task",
    }
  }
}

export async function toggleTaskAction(id: string): Promise<ActionResult<SerializedTask>> {
  try {
    const user = await resolveCurrentUser()

    if (!id || typeof id !== "string") {
      return { success: false, error: "Task ID is required" }
    }

    const existing = await prisma.task.findUnique({
      where: {
        id_userId: {
          id,
          userId: user.id,
        },
      },
    })

    if (!existing) {
      return { success: false, error: "Task not found or access denied" }
    }

    const newStatus: TaskStatus = existing.status === "COMPLETED" ? "TODO" : "COMPLETED"

    const updated = await prisma.task.update({
      where: {
        id_userId: {
          id,
          userId: user.id,
        },
      },
      data: {
        status: newStatus,
      },
    })

    // Log Activity
    await recordActivity(
      user.id,
      newStatus === "COMPLETED" ? "task_completed" : "task_updated",
      newStatus === "COMPLETED"
        ? `Completed task "${updated.title}"`
        : `Reopened task "${updated.title}"`,
      { taskId: id, status: newStatus }
    )

    return {
      success: true,
      data: serializeTask(updated),
    }
  } catch {
    return {
      success: false,
      error: "Failed to toggle task status",
    }
  }
}

export async function moveTaskAction(
  rawInput: MoveTaskInput
): Promise<ActionResult<SerializedTask>> {
  try {
    const user = await resolveCurrentUser()
    const parsed = moveTaskSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    const { taskId, targetStatus } = parsed.data

    const task = await prisma.task.update({
      where: {
        id_userId: {
          id: taskId,
          userId: user.id,
        },
      },
      data: {
        status: targetStatus,
      },
    })

    // Log Activity
    await recordActivity(
      user.id,
      targetStatus === "COMPLETED" ? "task_completed" : "task_updated",
      `Moved task "${task.title}" to ${targetStatus.replace("_", " ")}`,
      { taskId: task.id, status: targetStatus }
    )

    return {
      success: true,
      data: serializeTask(task),
    }
  } catch {
    return {
      success: false,
      error: "Task not found or access denied",
    }
  }
}

export async function reorderTaskAction(
  rawInput: ReorderTaskInput
): Promise<ActionResult<SerializedTask>> {
  try {
    const user = await resolveCurrentUser()
    const parsed = reorderTaskSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    const { taskId, targetStatus, aboveOrder, belowOrder, customOrder } = parsed.data

    // 1. Calculate midpoint position
    let newOrder: number
    if (typeof customOrder === "number" && !isNaN(customOrder)) {
      newOrder = customOrder
    } else {
      newOrder = calculateMidpointOrder(aboveOrder, belowOrder)
    }

    // 2. Atomic update of moved task
    const task = await prisma.task.update({
      where: {
        id_userId: {
          id: taskId,
          userId: user.id,
        },
      },
      data: {
        status: targetStatus,
        order: newOrder,
      },
    })

    // 3. Detect precision compression and rebalance column if needed
    if (isCompressionDetected(aboveOrder, belowOrder)) {
      await rebalanceColumnOrders(user.id, targetStatus)
      // Retrieve fresh rebalanced task
      const rebalanced = await prisma.task.findUnique({
        where: {
          id_userId: {
            id: taskId,
            userId: user.id,
          },
        },
      })
      if (rebalanced) {
        return {
          success: true,
          data: serializeTask(rebalanced),
        }
      }
    }

    return {
      success: true,
      data: serializeTask(task),
    }
  } catch {
    return {
      success: false,
      error: "Failed to reorder task: not found or access denied",
    }
  }
}
