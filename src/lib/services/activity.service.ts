import { prisma } from "@/lib/prisma"
import type { ActivityType, Prisma } from "@prisma/client"
import type { Activity } from "@/types"

/**
 * Trusted server-side activity recorder.
 * This is an internal server service and is NEVER exposed directly as a client-callable Server Action.
 * Audit records can only be created by legitimate server business operations (e.g. project/task/note mutations).
 */
export async function recordActivity(
  userId: string,
  type: ActivityType,
  title: string,
  metadata?: Record<string, Prisma.InputJsonValue>
): Promise<Activity> {
  const record = await prisma.activity.create({
    data: {
      userId,
      type,
      title: title.slice(0, 200),
      metadata: metadata ?? undefined,
    },
  })

  return {
    id: record.id,
    type: record.type as Activity["type"],
    title: record.title,
    timestamp: record.timestamp.toISOString(),
  }
}
