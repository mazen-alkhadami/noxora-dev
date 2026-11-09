import { z } from "zod"

export const defaultViewEnum = z.enum(["dashboard", "kanban", "tasks", "calendar"])
export const taskDensityEnum = z.enum(["comfortable", "compact"])

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .optional(),
    title: z
      .string()
      .trim()
      .max(100, "Title cannot exceed 100 characters")
      .optional(),
    initials: z
      .string()
      .trim()
      .max(5, "Initials cannot exceed 5 characters")
      .optional(),
  })
  .strip()

export const updatePreferencesSchema = z
  .object({
    defaultView: defaultViewEnum.optional(),
    taskDensity: taskDensityEnum.optional(),
    confirmBeforeDelete: z.boolean().optional(),
  })
  .strip()

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>
