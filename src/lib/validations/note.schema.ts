import { z } from "zod"

export const createNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Note title is required")
      .max(200, "Note title cannot exceed 200 characters"),
    content: z
      .string()
      .max(50000, "Content cannot exceed 50,000 characters")
      .default(""),
    projectId: z
      .string()
      .trim()
      .min(1, "Invalid project ID")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
  })
  .strip()

export const updateNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Note title cannot be empty")
      .max(200, "Note title cannot exceed 200 characters")
      .optional(),
    content: z
      .string()
      .max(50000, "Content cannot exceed 50,000 characters")
      .optional(),
    projectId: z
      .string()
      .trim()
      .min(1, "Invalid project ID")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
  })
  .strip()

export type CreateNoteInput = z.input<typeof createNoteSchema>
export type UpdateNoteInput = z.input<typeof updateNoteSchema>
