"use server"

import { prisma } from "@/lib/prisma"
import { resolveCurrentUser } from "@/lib/auth-context"
import { recordActivity } from "@/lib/services/activity.service"
import {
  createNoteSchema,
  updateNoteSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
} from "@/lib/validations/note.schema"
import { verifyProjectOwnership } from "@/lib/services/ownership.service"
import type { ActionResult } from "@/types/actions"
import type { Note } from "@/types"

function serializeNote(n: {
  id: string
  projectId: string | null
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}): Note {
  return {
    id: n.id,
    projectId: n.projectId,
    title: n.title,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }
}

export async function getNotesAction(): Promise<ActionResult<Note[]>> {
  try {
    const user = await resolveCurrentUser()
    const notes = await prisma.note.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    })

    return {
      success: true,
      data: notes.map(serializeNote),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notes"
    return { success: false, error: message }
  }
}

export async function createNoteAction(
  rawInput: CreateNoteInput
): Promise<ActionResult<Note>> {
  try {
    const user = await resolveCurrentUser()
    const parsed = createNoteSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    const { title, content, projectId } = parsed.data

    // Validate Project Ownership
    if (projectId) {
      const isOwner = await verifyProjectOwnership(user.id, projectId)
      if (!isOwner) {
        return { success: false, error: "Referenced project not found or access denied" }
      }
    }

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        projectId: projectId || null,
        title,
        content: content || "",
      },
    })

    // Log Activity
    await recordActivity(
      user.id,
      "note_created",
      `Created note "${note.title}"`,
      { noteId: note.id }
    )

    return {
      success: true,
      data: serializeNote(note),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create note"
    return { success: false, error: message }
  }
}

export async function updateNoteAction(
  id: string,
  rawInput: UpdateNoteInput
): Promise<ActionResult<Note>> {
  try {
    const user = await resolveCurrentUser()

    if (!id || typeof id !== "string") {
      return { success: false, error: "Note ID is required" }
    }

    const parsed = updateNoteSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    // Validate Project Ownership if updating project
    if (parsed.data.projectId !== undefined && parsed.data.projectId !== null) {
      const isOwner = await verifyProjectOwnership(user.id, parsed.data.projectId)
      if (!isOwner) {
        return { success: false, error: "Referenced project not found or access denied" }
      }
    }

    // Atomic tenant-isolated update via compound key
    const note = await prisma.note.update({
      where: {
        id_userId: {
          id,
          userId: user.id,
        },
      },
      data: parsed.data,
    })

    // Log Activity
    await recordActivity(
      user.id,
      "note_updated",
      `Updated note "${note.title}"`,
      { noteId: note.id }
    )

    return {
      success: true,
      data: serializeNote(note),
    }
  } catch {
    return {
      success: false,
      error: "Note not found or access denied",
    }
  }
}

export async function deleteNoteAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await resolveCurrentUser()

    if (!id || typeof id !== "string") {
      return { success: false, error: "Note ID is required" }
    }

    const existing = await prisma.note.findUnique({
      where: {
        id_userId: {
          id,
          userId: user.id,
        },
      },
      select: { title: true },
    })

    if (!existing) {
      return { success: false, error: "Note not found or access denied" }
    }

    await prisma.note.delete({
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
      "note_deleted",
      `Deleted note "${existing.title}"`,
      { noteId: id }
    )

    return {
      success: true,
      data: { id },
    }
  } catch {
    return {
      success: false,
      error: "Failed to delete note",
    }
  }
}
