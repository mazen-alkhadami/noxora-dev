import { z } from "zod"
import { taskStatusEnum } from "./task.schema"

export const moveTaskSchema = z
  .object({
    taskId: z.string().trim().min(1, "Task ID is required"),
    targetStatus: taskStatusEnum,
  })
  .strip()

export const reorderTaskSchema = z
  .object({
    taskId: z.string().trim().min(1, "Task ID is required"),
    targetStatus: taskStatusEnum,
    aboveOrder: z.number().nullable().optional(),
    belowOrder: z.number().nullable().optional(),
    customOrder: z.number().optional(),
  })
  .strip()

export type MoveTaskInput = z.infer<typeof moveTaskSchema>
export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>
