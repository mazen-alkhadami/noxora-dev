import { z } from "zod"

export const taskStatusEnum = z.enum(["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"])
export const taskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])

export const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Task title is required")
      .max(200, "Task title cannot exceed 200 characters"),
    description: z
      .string()
      .trim()
      .max(5000, "Description cannot exceed 5000 characters")
      .default(""),
    status: taskStatusEnum.default("TODO"),
    priority: taskPriorityEnum.default("MEDIUM"),
    dueDate: z
      .string()
      .regex(dateOnlyRegex, "Due date must be in YYYY-MM-DD format")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    projectId: z
      .string()
      .trim()
      .min(1, "Invalid project ID")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
  })
  .strip() // Strips any client-injected userId

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Task title cannot be empty")
      .max(200, "Task title cannot exceed 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(5000, "Description cannot exceed 5000 characters")
      .optional(),
    status: taskStatusEnum.optional(),
    priority: taskPriorityEnum.optional(),
    dueDate: z
      .string()
      .regex(dateOnlyRegex, "Due date must be in YYYY-MM-DD format")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    projectId: z
      .string()
      .trim()
      .min(1, "Invalid project ID")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    order: z.number().optional(),
  })
  .strip()

export type CreateTaskInput = z.input<typeof createTaskSchema>
export type UpdateTaskInput = z.input<typeof updateTaskSchema>
