import { prisma } from "@/lib/prisma"

/**
 * Verifies that a given project exists and is owned by the specified user.
 * Returns true if projectId is null or undefined (unassigned).
 */
export async function verifyProjectOwnership(
  userId: string,
  projectId: string | null | undefined
): Promise<boolean> {
  if (!projectId) {
    return true
  }

  const project = await prisma.project.findUnique({
    where: {
      id_userId: {
        id: projectId,
        userId,
      },
    },
    select: { id: true },
  })

  return project !== null
}
