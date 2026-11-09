"use server"

import { prisma } from "@/lib/prisma"
import { resolveCurrentUser } from "@/lib/auth-context"
import { recordActivity } from "@/lib/services/activity.service"
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/validations/project.schema"
import type { ActionResult } from "@/types/actions"
import type { Project } from "@/types"

function serializeProject(p: {
  id: string
  name: string
  description: string | null
  status: string
  color: string
  createdAt: Date
  updatedAt: Date
}): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description || "",
    status: p.status as Project["status"],
    color: p.color,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

export async function getProjectsAction(): Promise<ActionResult<Project[]>> {
  try {
    const user = await resolveCurrentUser()
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    return {
      success: true,
      data: projects.map(serializeProject),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load projects"
    return { success: false, error: message }
  }
}

export async function createProjectAction(
  rawInput: CreateProjectInput
): Promise<ActionResult<Project>> {
  try {
    const user = await resolveCurrentUser()
    const parsed = createProjectSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    const { name, description, status, color } = parsed.data

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name,
        description,
        status,
        color,
      },
    })

    // Log Activity
    await recordActivity(
      user.id,
      "project_created",
      `Created project "${project.name}"`,
      { projectId: project.id }
    )

    return {
      success: true,
      data: serializeProject(project),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project"
    return { success: false, error: message }
  }
}

export async function updateProjectAction(
  id: string,
  rawInput: UpdateProjectInput
): Promise<ActionResult<Project>> {
  try {
    const user = await resolveCurrentUser()

    if (!id || typeof id !== "string") {
      return { success: false, error: "Project ID is required" }
    }

    const parsed = updateProjectSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    // Atomic tenant-isolated update via compound key
    const project = await prisma.project.update({
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
      "project_updated",
      `Updated project "${project.name}"`,
      { projectId: project.id }
    )

    return {
      success: true,
      data: serializeProject(project),
    }
  } catch {
    // Prisma P2025: Record to update not found (or tenant mismatch)
    return {
      success: false,
      error: "Project not found or access denied",
    }
  }
}

export async function deleteProjectAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await resolveCurrentUser()

    if (!id || typeof id !== "string") {
      return { success: false, error: "Project ID is required" }
    }

    // Find first to retrieve project name for activity feed
    const existing = await prisma.project.findUnique({
      where: {
        id_userId: {
          id,
          userId: user.id,
        },
      },
      select: { name: true },
    })

    if (!existing) {
      return { success: false, error: "Project not found or access denied" }
    }

    // Delete project (Tasks and Notes will have projectId set to NULL via onDelete: SetNull)
    await prisma.project.delete({
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
      "project_deleted",
      `Deleted project "${existing.name}"`,
      { projectId: id }
    )

    return {
      success: true,
      data: { id },
    }
  } catch {
    return {
      success: false,
      error: "Failed to delete project",
    }
  }
}
