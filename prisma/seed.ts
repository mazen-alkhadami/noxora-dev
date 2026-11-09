import { PrismaClient } from "@prisma/client"
import {
  MOCK_PROJECTS,
  MOCK_TASKS,
  MOCK_NOTES,
  MOCK_ACTIVITIES,
  MOCK_PREFERENCES,
} from "../src/lib/mock-data"

const prisma = new PrismaClient()
const DEMO_USER_ID = "usr_demo_nexora_dev"
const DEMO_USER_EMAIL = "alex.rivera@nexora.dev"

async function main() {
  console.log("Seeding database for Demo User...")

  // 1. Upsert Demo User
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {
      name: "Alex Rivera",
      email: DEMO_USER_EMAIL,
      title: "Senior Full-Stack Developer",
      initials: "AR",
    },
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: "Alex Rivera",
      title: "Senior Full-Stack Developer",
      initials: "AR",
    },
  })

  // 2. Upsert Preferences
  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: {
      defaultView: MOCK_PREFERENCES.defaultView,
      taskDensity: MOCK_PREFERENCES.taskDensity,
      confirmBeforeDelete: MOCK_PREFERENCES.confirmBeforeDelete,
    },
    create: {
      userId: user.id,
      defaultView: MOCK_PREFERENCES.defaultView,
      taskDensity: MOCK_PREFERENCES.taskDensity,
      confirmBeforeDelete: MOCK_PREFERENCES.confirmBeforeDelete,
    },
  })

  // 3. Upsert Projects
  for (const p of MOCK_PROJECTS) {
    await prisma.project.upsert({
      where: { id_userId: { id: p.id, userId: user.id } },
      update: {
        name: p.name,
        description: p.description,
        status: p.status,
        color: p.color,
      },
      create: {
        id: p.id,
        userId: user.id,
        name: p.name,
        description: p.description,
        status: p.status,
        color: p.color,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      },
    })
  }

  // 4. Upsert Tasks
  for (const [i, t] of MOCK_TASKS.entries()) {
    const dueDate = t.dueDate ? new Date(t.dueDate) : null
    await prisma.task.upsert({
      where: { id_userId: { id: t.id, userId: user.id } },
      update: {
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate,
        projectId: t.projectId,
        order: (i + 1) * 1000.0,
      },
      create: {
        id: t.id,
        userId: user.id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate,
        order: (i + 1) * 1000.0,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      },
    })
  }

  // 5. Upsert Notes
  for (const n of MOCK_NOTES) {
    await prisma.note.upsert({
      where: { id_userId: { id: n.id, userId: user.id } },
      update: {
        title: n.title,
        content: n.content,
        projectId: n.projectId,
      },
      create: {
        id: n.id,
        userId: user.id,
        projectId: n.projectId,
        title: n.title,
        content: n.content,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt),
      },
    })
  }

  // 6. Upsert Activities
  for (const a of MOCK_ACTIVITIES) {
    const existing = await prisma.activity.findUnique({ where: { id: a.id } })
    if (existing) {
      await prisma.activity.update({
        where: { id: a.id },
        data: {
          type: a.type,
          title: a.title,
          timestamp: new Date(a.timestamp),
        },
      })
    } else {
      await prisma.activity.create({
        data: {
          id: a.id,
          userId: user.id,
          type: a.type,
          title: a.title,
          timestamp: new Date(a.timestamp),
        },
      })
    }
  }

  console.log("Seeding completed successfully.")
}

main()
  .catch((e) => {
    console.error("Seeding error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
