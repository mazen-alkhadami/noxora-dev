import { z } from "zod"

export const activityTypeEnum = z.enum([
  "project_created",
  "project_updated",
  "project_deleted",
  "task_created",
  "task_updated",
  "task_completed",
  "task_deleted",
  "note_created",
  "note_updated",
  "note_deleted",
])

export const createActivitySchema = z
  .object({
    type: activityTypeEnum,
    title: z
      .string()
      .trim()
      .min(1, "Activity title is required")
      .max(200, "Activity title cannot exceed 200 characters"),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strip()

export type CreateActivityInput = z.input<typeof createActivitySchema>
