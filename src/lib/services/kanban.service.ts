import { prisma } from "@/lib/prisma"
import type { TaskStatus } from "@prisma/client"

export const KANBAN_SPACING = 1000.0
export const PRECISION_THRESHOLD = 0.001

/**
 * Calculates the midpoint order for a task inserted between two sibling orders.
 */
export function calculateMidpointOrder(
  above: number | null | undefined,
  below: number | null | undefined
): number {
  const hasAbove = typeof above === "number" && !isNaN(above)
  const hasBelow = typeof below === "number" && !isNaN(below)

  // Scenario 1: Empty column
  if (!hasAbove && !hasBelow) {
    return KANBAN_SPACING
  }

  // Scenario 2: Column head (before the current first item)
  if (!hasAbove && hasBelow) {
    if (below > 1.0) {
      return Math.max(0.0, below - KANBAN_SPACING)
    }
    return below / 2.0
  }

  // Scenario 3: Column tail (after the current last item)
  if (hasAbove && !hasBelow) {
    return above + KANBAN_SPACING
  }

  // Scenario 4: Between two items
  if (hasAbove && hasBelow) {
    return (above + below) / 2.0
  }

  return KANBAN_SPACING
}

/**
 * Checks whether the gap between two sibling orders is too narrow, requiring rebalancing.
 */
export function isCompressionDetected(
  above: number | null | undefined,
  below: number | null | undefined
): boolean {
  if (typeof above === "number" && typeof below === "number") {
    return Math.abs(below - above) < PRECISION_THRESHOLD
  }
  return false
}

/**
 * Rebalances a column's task orders transactionally to 1000-unit intervals.
 * Scoped strictly to the specific userId and TaskStatus.
 */
export async function rebalanceColumnOrders(
  userId: string,
  status: TaskStatus
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const columnTasks = await tx.task.findMany({
      where: { userId, status },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    })

    for (let i = 0; i < columnTasks.length; i++) {
      const task = columnTasks[i]
      if (task) {
        await tx.task.update({
          where: { id_userId: { id: task.id, userId } },
          data: { order: (i + 1) * KANBAN_SPACING },
        })
      }
    }
  })
}
