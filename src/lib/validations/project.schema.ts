import { z } from "zod"

export const projectStatusEnum = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"])

export const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Project name is required")
      .max(100, "Project name cannot exceed 100 characters"),
    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .default(""),
    status: projectStatusEnum.default("ACTIVE"),
    color: z
      .string()
      .regex(hexColorRegex, "Invalid hex color code")
      .default("#6366f1"),
  })
  .strip() // Strips any client-injected fields such as userId

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Project name cannot be empty")
      .max(100, "Project name cannot exceed 100 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .optional(),
    status: projectStatusEnum.optional(),
    color: z
      .string()
      .regex(hexColorRegex, "Invalid hex color code")
      .optional(),
  })
  .strip()

export type CreateProjectInput = z.input<typeof createProjectSchema>
export type UpdateProjectInput = z.input<typeof updateProjectSchema>
