"use client"

import * as React from "react"
import {
  readStorage,
  writeStorage,
  generateId,
} from "@/lib/storage"
import {
  MOCK_PROJECTS,
  MOCK_TASKS,
  MOCK_NOTES,
  MOCK_ACTIVITIES,
  MOCK_PROFILE,
  MOCK_PREFERENCES,
} from "@/lib/mock-data"
import type {
  Project,
  Task,
  Note,
  Activity,
  UserProfile,
  UserPreferences,
  ProjectFormData,
  TaskFormData,
  NoteFormData,
  TaskStatus,
  SyncState,
} from "@/types"
import {
  getProjectsAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from "@/actions/project.actions"
import {
  getTasksAction,
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
  toggleTaskAction,
  moveTaskAction,
  reorderTaskAction,
} from "@/actions/task.actions"
import {
  getNotesAction,
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "@/actions/note.actions"
import { getActivitiesAction } from "@/actions/activity.actions"
import {
  getSettingsAction,
  updateProfileAction,
  updatePreferencesAction,
} from "@/actions/settings.actions"
import {
  checkMigrationStatusAction,
  executeMigrationAction,
} from "@/actions/migration.actions"

export const STORAGE_KEYS = {
  PROJECTS: "nexora:projects",
  TASKS: "nexora:tasks",
  NOTES: "nexora:notes",
  ACTIVITIES: "nexora:activities",
  PROFILE: "nexora:profile",
  PREFERENCES: "nexora:preferences",
  MIGRATED: "nexora:migrated",
  DISMISSED_MIGRATION: "nexora:dismissed_migration",
}

export interface MigrationState {
  needsMigration: boolean
  isMigrating: boolean
  progress?: string
  error?: string
}

export interface DataContextType {
  projects: Project[]
  tasks: Task[]
  notes: Note[]
  activities: Activity[]
  profile: UserProfile
  preferences: UserPreferences
  isLoaded: boolean
  syncState: SyncState
  lastSyncError: string | null
  migrationStatus: MigrationState
  triggerMigration: () => Promise<void>
  dismissMigration: () => void
  retrySync: () => Promise<void>
  addProject: (data: ProjectFormData) => Project
  updateProject: (id: string, data: Partial<ProjectFormData>) => void
  deleteProject: (id: string) => void
  addTask: (data: TaskFormData) => Task
  updateTask: (id: string, data: Partial<TaskFormData>) => void
  moveTask: (taskId: string, targetStatus: TaskStatus) => void
  reorderTasks: (newTasks: Task[]) => void
  toggleTaskStatus: (id: string) => void
  deleteTask: (id: string) => void
  addNote: (data: NoteFormData) => Note
  updateNote: (id: string, data: Partial<NoteFormData>) => void
  deleteNote: (id: string) => void
  updateProfile: (data: Partial<UserProfile>) => void
  updatePreferences: (data: Partial<UserPreferences>) => void
  resetAllData: () => void
  getProjectTasks: (projectId: string) => Task[]
  getProjectProgress: (projectId: string) => number
}

const DataContext = React.createContext<DataContextType | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [notes, setNotes] = React.useState<Note[]>([])
  const [activities, setActivities] = React.useState<Activity[]>([])
  const [profile, setProfile] = React.useState<UserProfile>(MOCK_PROFILE)
  const [preferences, setPreferences] = React.useState<UserPreferences>(MOCK_PREFERENCES)
  const [isLoaded, setIsLoaded] = React.useState(false)

  // Synchronization & Migration State
  const [syncState, setSyncState] = React.useState<SyncState>("SYNCING")
  const [lastSyncError, setLastSyncError] = React.useState<string | null>(null)
  const [migrationStatus, setMigrationStatus] = React.useState<MigrationState>({
    needsMigration: false,
    isMigrating: false,
  })

  // Concurrency-safe in-flight operations counter
  const inFlightOps = React.useRef(0)

  const beginOp = React.useCallback(() => {
    inFlightOps.current += 1
    setSyncState("SYNCING")
  }, [])

  const endOp = React.useCallback((success: boolean, error?: string) => {
    inFlightOps.current = Math.max(0, inFlightOps.current - 1)
    if (inFlightOps.current === 0) {
      if (success) {
        setSyncState("SYNCED")
        setLastSyncError(null)
      } else {
        if (error?.includes("Validation") || error?.includes("Referenced project")) {
          setSyncState("SYNC_FAILED")
        } else {
          setSyncState("OFFLINE_LOCAL")
        }
        setLastSyncError(error || "Operation failed")
      }
    } else {
      if (!success) {
        setLastSyncError(error || "Operation failed")
      }
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Initial Load: LocalStorage Cache first, then reconcile with PostgreSQL
  // ─────────────────────────────────────────────────────────────────────────────

  const fetchServerData = React.useCallback(async () => {
    setSyncState("SYNCING")
    setLastSyncError(null)

    try {
      const [
        projectsRes,
        tasksRes,
        notesRes,
        activitiesRes,
        settingsRes,
        migrationCheckRes,
      ] = await Promise.all([
        getProjectsAction(),
        getTasksAction(),
        getNotesAction(),
        getActivitiesAction(25),
        getSettingsAction(),
        checkMigrationStatusAction(),
      ])

      // If database queries succeed, check migration status first
      if (projectsRes.success && tasksRes.success && notesRes.success) {
        const needsMigration = migrationCheckRes.success && migrationCheckRes.data.needsMigration
        const isDismissed = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEYS.DISMISSED_MIGRATION) === "true"

        const localProjects = readStorage<Project[]>(STORAGE_KEYS.PROJECTS) || []
        const localTasks = readStorage<Task[]>(STORAGE_KEYS.TASKS) || []
        const localNotes = readStorage<Note[]>(STORAGE_KEYS.NOTES) || []

        const hasLocalData =
          (localProjects.length > 0 || localTasks.length > 0 || localNotes.length > 0) &&
          projectsRes.data.length === 0 &&
          tasksRes.data.length === 0

        // If local data exists and needs migration, preserve local storage & prompt user
        if (needsMigration && hasLocalData && !isDismissed) {
          setMigrationStatus({
            needsMigration: true,
            isMigrating: false,
          })
          setSyncState("OFFLINE_LOCAL")
          return
        }

        // Database is authoritative: populate and cache
        setProjects(projectsRes.data)
        setTasks(tasksRes.data)
        setNotes(notesRes.data)

        if (activitiesRes.success) {
          setActivities(activitiesRes.data)
        }

        if (settingsRes.success) {
          setProfile(settingsRes.data.profile)
          setPreferences(settingsRes.data.preferences)
        }

        // Cache server state in localStorage as an offline backup
        writeStorage(STORAGE_KEYS.PROJECTS, projectsRes.data)
        writeStorage(STORAGE_KEYS.TASKS, tasksRes.data)
        writeStorage(STORAGE_KEYS.NOTES, notesRes.data)
        if (activitiesRes.success) writeStorage(STORAGE_KEYS.ACTIVITIES, activitiesRes.data)
        if (settingsRes.success) {
          writeStorage(STORAGE_KEYS.PROFILE, settingsRes.data.profile)
          writeStorage(STORAGE_KEYS.PREFERENCES, settingsRes.data.preferences)
        }

        if (inFlightOps.current === 0) {
          setSyncState("SYNCED")
        }
      } else {
        const errMessage =
          (!projectsRes.success ? projectsRes.error : null) ||
          (!tasksRes.success ? tasksRes.error : null) ||
          (!notesRes.success ? notesRes.error : null) ||
          "Database unavailable"
        setSyncState("OFFLINE_LOCAL")
        setLastSyncError(errMessage)
      }
    } catch (err) {
      setSyncState("OFFLINE_LOCAL")
      const message = err instanceof Error ? err.message : "Failed to connect to cloud database"
      setLastSyncError(message)
    }
  }, [])

  React.useEffect(() => {
    // 1. Initial fast local load to eliminate hydration lag
    const savedProjects = readStorage<Project[]>(STORAGE_KEYS.PROJECTS)
    const savedTasks = readStorage<Task[]>(STORAGE_KEYS.TASKS)
    const savedNotes = readStorage<Note[]>(STORAGE_KEYS.NOTES)
    const savedActivities = readStorage<Activity[]>(STORAGE_KEYS.ACTIVITIES)
    const savedProfile = readStorage<UserProfile>(STORAGE_KEYS.PROFILE)
    const savedPreferences = readStorage<UserPreferences>(STORAGE_KEYS.PREFERENCES)

    setProjects(savedProjects && savedProjects.length > 0 ? savedProjects : MOCK_PROJECTS)
    setTasks(savedTasks && savedTasks.length > 0 ? savedTasks : MOCK_TASKS)
    setNotes(savedNotes && savedNotes.length > 0 ? savedNotes : MOCK_NOTES)
    setActivities(savedActivities && savedActivities.length > 0 ? savedActivities : MOCK_ACTIVITIES)
    if (savedProfile) setProfile(savedProfile)
    if (savedPreferences) setPreferences(savedPreferences)

    setIsLoaded(true)

    // 2. Fetch fresh cloud database state asynchronously
    fetchServerData()
  }, [fetchServerData])

  const retrySync = React.useCallback(async () => {
    await fetchServerData()
  }, [fetchServerData])

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Safe Migration Protocol
  // ─────────────────────────────────────────────────────────────────────────────

  const triggerMigration = React.useCallback(async () => {
    setMigrationStatus((prev) => ({ ...prev, isMigrating: true, error: undefined, progress: "Creating backup snapshot..." }))
    setSyncState("SYNCING")

    try {
      // 1. Create immutable timestamped backup in localStorage
      const timestamp = new Date().toISOString()
      const backupPayload = {
        projects: readStorage<Project[]>(STORAGE_KEYS.PROJECTS) || projects,
        tasks: readStorage<Task[]>(STORAGE_KEYS.TASKS) || tasks,
        notes: readStorage<Note[]>(STORAGE_KEYS.NOTES) || notes,
        preferences,
      }
      localStorage.setItem(`nexora:backup:${Date.now()}`, JSON.stringify(backupPayload))

      setMigrationStatus((prev) => ({ ...prev, progress: "Uploading projects, tasks, and notes..." }))

      // 2. Execute chunked server migration
      const res = await executeMigrationAction(backupPayload)

      if (res.success) {
        localStorage.setItem(STORAGE_KEYS.MIGRATED, timestamp)
        setMigrationStatus({
          needsMigration: false,
          isMigrating: false,
        })
        // Reload fresh authoritative records
        await fetchServerData()
      } else {
        setMigrationStatus((prev) => ({
          ...prev,
          isMigrating: false,
          error: res.error || "Migration failed. Local data preserved safely.",
        }))
        setSyncState("SYNC_FAILED")
        setLastSyncError(res.error || "Migration failed")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Migration failed"
      setMigrationStatus((prev) => ({
        ...prev,
        isMigrating: false,
        error: message,
      }))
      setSyncState("SYNC_FAILED")
      setLastSyncError(message)
    }
  }, [projects, tasks, notes, preferences, fetchServerData])

  const dismissMigration = React.useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.DISMISSED_MIGRATION, "true")
    setMigrationStatus((prev) => ({ ...prev, needsMigration: false }))
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Project Mutations (Optimistic UI + Server Actions)
  // ─────────────────────────────────────────────────────────────────────────────

  const addProject = React.useCallback(
    (data: ProjectFormData): Project => {
      const optimisticProject: Project = {
        id: generateId(),
        name: data.name,
        description: data.description || "",
        status: data.status || "ACTIVE",
        color: data.color || "#6366f1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setProjects((prev) => {
        const next = [optimisticProject, ...prev]
        writeStorage(STORAGE_KEYS.PROJECTS, next)
        return next
      })
      beginOp()

      createProjectAction({
        name: data.name,
        description: data.description,
        status: data.status,
        color: data.color,
      }).then(async (res) => {
        if (res.success) {
          setProjects((prev) => {
            const next = prev.map((p) => (p.id === optimisticProject.id ? res.data : p))
            writeStorage(STORAGE_KEYS.PROJECTS, next)
            return next
          })
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (res.error?.includes("Validation")) {
            setProjects((prev) => {
              const next = prev.filter((p) => p.id !== optimisticProject.id)
              writeStorage(STORAGE_KEYS.PROJECTS, next)
              return next
            })
            endOp(false, res.error)
          } else {
            endOp(false, res.error || "Offline: Saved locally only")
          }
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })

      return optimisticProject
    },
    [beginOp, endOp]
  )

  const updateProject = React.useCallback(
    (id: string, data: Partial<ProjectFormData>) => {
      let originalProject: Project | undefined

      setProjects((prev) => {
        originalProject = prev.find((p) => p.id === id)
        const next = prev.map((proj) =>
          proj.id === id ? { ...proj, ...data, updatedAt: new Date().toISOString() } : proj
        )
        writeStorage(STORAGE_KEYS.PROJECTS, next)
        return next
      })
      beginOp()

      updateProjectAction(id, data).then(async (res) => {
        if (res.success) {
          setProjects((prev) => {
            const next = prev.map((p) => (p.id === id ? res.data : p))
            writeStorage(STORAGE_KEYS.PROJECTS, next)
            return next
          })
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (res.error?.includes("Validation")) {
            if (originalProject) {
              setProjects((prev) => {
                const next = prev.map((p) => (p.id === id ? originalProject! : p))
                writeStorage(STORAGE_KEYS.PROJECTS, next)
                return next
              })
            }
            endOp(false, res.error)
          } else {
            endOp(false, res.error || "Offline: Saved locally only")
          }
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  const deleteProject = React.useCallback(
    (id: string) => {
      let originalProject: Project | undefined
      let affectedTasks: Task[] = []
      let affectedNotes: Note[] = []

      setProjects((prev) => {
        originalProject = prev.find((p) => p.id === id)
        const next = prev.filter((p) => p.id !== id)
        writeStorage(STORAGE_KEYS.PROJECTS, next)
        return next
      })
      setTasks((prev) => {
        affectedTasks = prev.filter((t) => t.projectId === id)
        const next = prev.map((t) => (t.projectId === id ? { ...t, projectId: null } : t))
        writeStorage(STORAGE_KEYS.TASKS, next)
        return next
      })
      setNotes((prev) => {
        affectedNotes = prev.filter((n) => n.projectId === id)
        const next = prev.map((n) => (n.projectId === id ? { ...n, projectId: null } : n))
        writeStorage(STORAGE_KEYS.NOTES, next)
        return next
      })
      beginOp()

      deleteProjectAction(id).then(async (res) => {
        if (res.success) {
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (originalProject) {
            setProjects((prev) => {
              const next = prev.some((p) => p.id === id) ? prev : [originalProject!, ...prev]
              writeStorage(STORAGE_KEYS.PROJECTS, next)
              return next
            })
          }
          if (affectedTasks.length > 0) {
            const taskIds = new Set(affectedTasks.map((t) => t.id))
            setTasks((prev) => {
              const next = prev.map((t) => (taskIds.has(t.id) ? { ...t, projectId: id } : t))
              writeStorage(STORAGE_KEYS.TASKS, next)
              return next
            })
          }
          if (affectedNotes.length > 0) {
            const noteIds = new Set(affectedNotes.map((n) => n.id))
            setNotes((prev) => {
              const next = prev.map((n) => (noteIds.has(n.id) ? { ...n, projectId: id } : n))
              writeStorage(STORAGE_KEYS.NOTES, next)
              return next
            })
          }
          endOp(false, res.error || "Failed to delete project")
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Task Mutations (Optimistic UI + Server Actions)
  // ─────────────────────────────────────────────────────────────────────────────

  const addTask = React.useCallback(
    (data: TaskFormData): Task => {
      const optimisticTask: Task = {
        id: generateId(),
        projectId: data.projectId ?? null,
        title: data.title,
        description: data.description || "",
        status: data.status || "TODO",
        priority: data.priority || "MEDIUM",
        dueDate: data.dueDate || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setTasks((prev) => {
        const next = [optimisticTask, ...prev]
        writeStorage(STORAGE_KEYS.TASKS, next)
        return next
      })
      beginOp()

      createTaskAction({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? data.dueDate.slice(0, 10) : null,
        projectId: data.projectId,
      }).then(async (res) => {
        if (res.success) {
          setTasks((prev) => {
            const next = prev.map((t) => (t.id === optimisticTask.id ? res.data : t))
            writeStorage(STORAGE_KEYS.TASKS, next)
            return next
          })
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (res.error?.includes("Validation") || res.error?.includes("Referenced project")) {
            setTasks((prev) => {
              const next = prev.filter((t) => t.id !== optimisticTask.id)
              writeStorage(STORAGE_KEYS.TASKS, next)
              return next
            })
            endOp(false, res.error)
          } else {
            endOp(false, res.error || "Offline: Saved locally only")
          }
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })

      return optimisticTask
    },
    [beginOp, endOp]
  )

  const updateTask = React.useCallback(
    (id: string, data: Partial<TaskFormData>) => {
      let originalTask: Task | undefined

      setTasks((prev) => {
        originalTask = prev.find((t) => t.id === id)
        const next = prev.map((t) =>
          t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
        )
        writeStorage(STORAGE_KEYS.TASKS, next)
        return next
      })
      beginOp()

      updateTaskAction(id, {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? data.dueDate.slice(0, 10) : data.dueDate === null ? null : undefined,
        projectId: data.projectId,
      }).then(async (res) => {
        if (res.success) {
          setTasks((prev) => {
            const next = prev.map((t) => (t.id === id ? res.data : t))
            writeStorage(STORAGE_KEYS.TASKS, next)
            return next
          })
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (res.error?.includes("Validation") || res.error?.includes("Referenced project")) {
            if (originalTask) {
              setTasks((prev) => {
                const next = prev.map((t) => (t.id === id ? originalTask! : t))
                writeStorage(STORAGE_KEYS.TASKS, next)
                return next
              })
            }
            endOp(false, res.error)
          } else {
            endOp(false, res.error || "Offline: Saved locally only")
          }
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  const moveTask = React.useCallback(
    (taskId: string, targetStatus: TaskStatus) => {
      let originalTask: Task | undefined

      setTasks((prev) => {
        originalTask = prev.find((t) => t.id === taskId)
        const next = prev.map((t) =>
          t.id === taskId ? { ...t, status: targetStatus, updatedAt: new Date().toISOString() } : t
        )
        writeStorage(STORAGE_KEYS.TASKS, next)
        return next
      })
      beginOp()

      moveTaskAction({ taskId, targetStatus }).then(async (res) => {
        if (res.success) {
          setTasks((prev) => {
            const next = prev.map((t) => (t.id === taskId ? res.data : t))
            writeStorage(STORAGE_KEYS.TASKS, next)
            return next
          })
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (originalTask) {
            setTasks((prev) => {
              const next = prev.map((t) => (t.id === taskId ? originalTask! : t))
              writeStorage(STORAGE_KEYS.TASKS, next)
              return next
            })
          }
          endOp(false, res.error || "Failed to move task")
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  const reorderTasks = React.useCallback(
    (newTasks: Task[]) => {
      let movedTaskId: string | null = null
      let targetStatus: TaskStatus = "TODO"

      setTasks((prev) => {
        for (let i = 0; i < newTasks.length; i++) {
          const currentTask = newTasks[i]
          const oldIndex = prev.findIndex((t) => t.id === currentTask?.id)
          if (currentTask && oldIndex !== -1 && oldIndex !== i) {
            movedTaskId = currentTask.id
            targetStatus = currentTask.status
            break
          }
        }
        writeStorage(STORAGE_KEYS.TASKS, newTasks)
        return newTasks
      })

      if (movedTaskId) {
        beginOp()
        const columnTasks = newTasks.filter((t) => t.status === targetStatus)
        const colIdx = columnTasks.findIndex((t) => t.id === movedTaskId)
        const aboveTask = colIdx > 0 ? columnTasks[colIdx - 1] : null
        const belowTask = colIdx < columnTasks.length - 1 ? columnTasks[colIdx + 1] : null

        const aboveOrder = (aboveTask as { order?: number } | null)?.order ?? (aboveTask ? colIdx * 1000 : null)
        const belowOrder = (belowTask as { order?: number } | null)?.order ?? (belowTask ? (colIdx + 2) * 1000 : null)

        reorderTaskAction({
          taskId: movedTaskId,
          targetStatus,
          aboveOrder: typeof aboveOrder === "number" ? aboveOrder : null,
          belowOrder: typeof belowOrder === "number" ? belowOrder : null,
        }).then((res) => {
          if (res.success) {
            endOp(true)
          } else {
            endOp(false, res.error || "Offline: Saved locally only")
          }
        }).catch(() => {
          endOp(false, "Offline: Saved locally only")
        })
      }
    },
    [beginOp, endOp]
  )

  const toggleTaskStatus = React.useCallback(
    (id: string) => {
      let originalTask: Task | undefined

      setTasks((prev) => {
        originalTask = prev.find((t) => t.id === id)
        if (!originalTask) return prev
        const nextStatus: TaskStatus = originalTask.status === "COMPLETED" ? "TODO" : "COMPLETED"
        const next = prev.map((t) =>
          t.id === id ? { ...t, status: nextStatus, updatedAt: new Date().toISOString() } : t
        )
        writeStorage(STORAGE_KEYS.TASKS, next)
        return next
      })

      beginOp()

      toggleTaskAction(id).then(async (res) => {
        if (res.success) {
          setTasks((prev) => {
            const next = prev.map((t) => (t.id === id ? res.data : t))
            writeStorage(STORAGE_KEYS.TASKS, next)
            return next
          })
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (originalTask) {
            setTasks((prev) => {
              const next = prev.map((t) => (t.id === id ? originalTask! : t))
              writeStorage(STORAGE_KEYS.TASKS, next)
              return next
            })
          }
          endOp(false, res.error || "Failed to toggle task status")
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  const deleteTask = React.useCallback(
    (id: string) => {
      let originalTask: Task | undefined

      setTasks((prev) => {
        originalTask = prev.find((t) => t.id === id)
        const next = prev.filter((t) => t.id !== id)
        writeStorage(STORAGE_KEYS.TASKS, next)
        return next
      })
      beginOp()

      deleteTaskAction(id).then(async (res) => {
        if (res.success) {
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (originalTask) {
            setTasks((prev) => {
              const next = prev.some((t) => t.id === id) ? prev : [originalTask!, ...prev]
              writeStorage(STORAGE_KEYS.TASKS, next)
              return next
            })
          }
          endOp(false, res.error || "Failed to delete task")
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Note Mutations (Optimistic UI + Server Actions)
  // ─────────────────────────────────────────────────────────────────────────────

  const addNote = React.useCallback(
    (data: NoteFormData): Note => {
      const optimisticNote: Note = {
        id: generateId(),
        projectId: data.projectId ?? null,
        title: data.title,
        content: data.content || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setNotes((prev) => {
        const next = [optimisticNote, ...prev]
        writeStorage(STORAGE_KEYS.NOTES, next)
        return next
      })
      beginOp()

      createNoteAction({
        title: data.title,
        content: data.content,
        projectId: data.projectId,
      }).then(async (res) => {
        if (res.success) {
          setNotes((prev) => {
            const next = prev.map((n) => (n.id === optimisticNote.id ? res.data : n))
            writeStorage(STORAGE_KEYS.NOTES, next)
            return next
          })
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (res.error?.includes("Validation") || res.error?.includes("Referenced project")) {
            setNotes((prev) => {
              const next = prev.filter((n) => n.id !== optimisticNote.id)
              writeStorage(STORAGE_KEYS.NOTES, next)
              return next
            })
            endOp(false, res.error)
          } else {
            endOp(false, res.error || "Offline: Saved locally only")
          }
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })

      return optimisticNote
    },
    [beginOp, endOp]
  )

  const updateNote = React.useCallback(
    (id: string, data: Partial<NoteFormData>) => {
      let originalNote: Note | undefined

      setNotes((prev) => {
        originalNote = prev.find((n) => n.id === id)
        const next = prev.map((n) =>
          n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n
        )
        writeStorage(STORAGE_KEYS.NOTES, next)
        return next
      })
      beginOp()

      updateNoteAction(id, data).then(async (res) => {
        if (res.success) {
          setNotes((prev) => {
            const next = prev.map((n) => (n.id === id ? res.data : n))
            writeStorage(STORAGE_KEYS.NOTES, next)
            return next
          })
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (originalNote) {
            setNotes((prev) => {
              const next = prev.map((n) => (n.id === id ? originalNote! : n))
              writeStorage(STORAGE_KEYS.NOTES, next)
              return next
            })
          }
          endOp(false, res.error || "Failed to update note")
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  const deleteNote = React.useCallback(
    (id: string) => {
      let originalNote: Note | undefined

      setNotes((prev) => {
        originalNote = prev.find((n) => n.id === id)
        const next = prev.filter((n) => n.id !== id)
        writeStorage(STORAGE_KEYS.NOTES, next)
        return next
      })
      beginOp()

      deleteNoteAction(id).then(async (res) => {
        if (res.success) {
          const activitiesRes = await getActivitiesAction(25)
          if (activitiesRes.success) setActivities(activitiesRes.data)
          endOp(true)
        } else {
          if (originalNote) {
            setNotes((prev) => {
              const next = prev.some((n) => n.id === id) ? prev : [originalNote!, ...prev]
              writeStorage(STORAGE_KEYS.NOTES, next)
              return next
            })
          }
          endOp(false, res.error || "Failed to delete note")
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Settings Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const updateProfile = React.useCallback(
    (data: Partial<UserProfile>) => {
      let originalProfile: UserProfile | undefined

      setProfile((prev) => {
        originalProfile = prev
        const updated: UserProfile = { ...prev, ...data }

        if (data.name) {
          const parts = data.name.trim().split(" ")
          updated.initials =
            parts.length > 1
              ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
              : (parts[0]?.substring(0, 2) || "U").toUpperCase()
        }

        writeStorage(STORAGE_KEYS.PROFILE, updated)
        return updated
      })
      beginOp()

      updateProfileAction({
        name: data.name,
        email: data.email,
        title: data.title,
        initials: data.name
          ? (data.name.trim().split(" ").length > 1
              ? `${data.name.trim().split(" ")[0]![0]}${data.name.trim().split(" ")[data.name.trim().split(" ").length - 1]![0]}`.toUpperCase()
              : (data.name.trim().split(" ")[0]?.substring(0, 2) || "U").toUpperCase())
          : undefined,
      }).then((res) => {
        if (res.success) {
          setProfile(res.data)
          writeStorage(STORAGE_KEYS.PROFILE, res.data)
          endOp(true)
        } else {
          if (originalProfile) {
            setProfile(originalProfile)
            writeStorage(STORAGE_KEYS.PROFILE, originalProfile)
          }
          endOp(false, res.error || "Failed to update profile")
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  const updatePreferences = React.useCallback(
    (data: Partial<UserPreferences>) => {
      let originalPreferences: UserPreferences | undefined

      setPreferences((prev) => {
        originalPreferences = prev
        const updated: UserPreferences = { ...prev, ...data }
        writeStorage(STORAGE_KEYS.PREFERENCES, updated)
        return updated
      })
      beginOp()

      updatePreferencesAction(data).then((res) => {
        if (res.success) {
          setPreferences(res.data)
          writeStorage(STORAGE_KEYS.PREFERENCES, res.data)
          endOp(true)
        } else {
          if (originalPreferences) {
            setPreferences(originalPreferences)
            writeStorage(STORAGE_KEYS.PREFERENCES, originalPreferences)
          }
          endOp(false, res.error || "Failed to update preferences")
        }
      }).catch(() => {
        endOp(false, "Offline: Saved locally only")
      })
    },
    [beginOp, endOp]
  )

  const resetAllData = React.useCallback(() => {
    setProjects(MOCK_PROJECTS)
    setTasks(MOCK_TASKS)
    setNotes(MOCK_NOTES)
    setActivities(MOCK_ACTIVITIES)
    setProfile(MOCK_PROFILE)
    setPreferences(MOCK_PREFERENCES)

    writeStorage(STORAGE_KEYS.PROJECTS, MOCK_PROJECTS)
    writeStorage(STORAGE_KEYS.TASKS, MOCK_TASKS)
    writeStorage(STORAGE_KEYS.NOTES, MOCK_NOTES)
    writeStorage(STORAGE_KEYS.ACTIVITIES, MOCK_ACTIVITIES)
    writeStorage(STORAGE_KEYS.PROFILE, MOCK_PROFILE)
    writeStorage(STORAGE_KEYS.PREFERENCES, MOCK_PREFERENCES)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Dynamic Project Progress (Derived from Tasks)
  // ─────────────────────────────────────────────────────────────────────────────

  const getProjectTasks = React.useCallback(
    (projectId: string) => {
      return tasks.filter((t) => t.projectId === projectId)
    },
    [tasks]
  )

  const getProjectProgress = React.useCallback(
    (projectId: string) => {
      const projTasks = tasks.filter((t) => t.projectId === projectId)
      if (projTasks.length === 0) return 0
      const completed = projTasks.filter((t) => t.status === "COMPLETED").length
      return Math.round((completed / projTasks.length) * 100)
    },
    [tasks]
  )

  const value = React.useMemo(
    () => ({
      projects,
      tasks,
      notes,
      activities,
      profile,
      preferences,
      isLoaded,
      syncState,
      lastSyncError,
      migrationStatus,
      triggerMigration,
      dismissMigration,
      retrySync,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      moveTask,
      reorderTasks,
      toggleTaskStatus,
      deleteTask,
      addNote,
      updateNote,
      deleteNote,
      updateProfile,
      updatePreferences,
      resetAllData,
      getProjectTasks,
      getProjectProgress,
    }),
    [
      projects,
      tasks,
      notes,
      activities,
      profile,
      preferences,
      isLoaded,
      syncState,
      lastSyncError,
      migrationStatus,
      triggerMigration,
      dismissMigration,
      retrySync,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      moveTask,
      reorderTasks,
      toggleTaskStatus,
      deleteTask,
      addNote,
      updateNote,
      deleteNote,
      updateProfile,
      updatePreferences,
      resetAllData,
      getProjectTasks,
      getProjectProgress,
    ]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = React.useContext(DataContext)
  if (!context) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
