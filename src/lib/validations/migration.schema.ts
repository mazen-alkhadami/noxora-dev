import { z } from "zod"
import { updatePreferencesSchema } from "./settings.schema"

export const migratedProjectSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, "Project name is required").max(100),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]),
  color: z.string().max(32).optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
})

export const migratedTaskSchema = z.object({
  id: z.string().min(1).max(64),
  projectId: z.string().max(64).optional().nullable(),
  title: z.string().trim().min(1, "Task title is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.string().max(30).optional().nullable(),
  order: z.number().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
})

export const migratedNoteSchema = z.object({
  id: z.string().min(1).max(64),
  projectId: z.string().max(64).optional().nullable(),
  title: z.string().trim().min(1, "Note title is required").max(200),
  content: z.string().max(50000).optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
})

export const migrationPayloadSchema = z.object({
  projects: z.array(migratedProjectSchema).max(500, "Cannot migrate more than 500 projects at once"),
  tasks: z.array(migratedTaskSchema).max(2000, "Cannot migrate more than 2000 tasks at once"),
  notes: z.array(migratedNoteSchema).max(1000, "Cannot migrate more than 1000 notes at once"),
  preferences: updatePreferencesSchema.optional().nullable(),
})

export type MigrationPayloadInput = z.infer<typeof migrationPayloadSchema>
