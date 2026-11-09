"use server"

import { prisma } from "@/lib/prisma"
import { resolveCurrentUser } from "@/lib/auth-context"
import type { ActionResult } from "@/types/actions"
import type { Activity } from "@/types"

function serializeActivity(a: {
  id: string
  type: string
  title: string
  timestamp: Date
}): Activity {
  return {
    id: a.id,
    type: a.type as Activity["type"],
    title: a.title,
    timestamp: a.timestamp.toISOString(),
  }
}

/**
 * Retrieves the activity history for the currently authenticated user.
 * Activity creation is intentionally NOT exposed as a client-callable Server Action
 * to prevent clients from forging misleading or arbitrary audit records.
 * Activities can only be generated through trusted server-side business operations.
 */
export async function getActivitiesAction(
  limit = 20
): Promise<ActionResult<Activity[]>> {
  try {
    const user = await resolveCurrentUser()
    const safeLimit = Math.min(Math.max(1, limit), 100)

    const activities = await prisma.activity.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: "desc" },
      take: safeLimit,
    })

    return {
      success: true,
      data: activities.map(serializeActivity),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load activities"
    return { success: false, error: message }
  }
}
