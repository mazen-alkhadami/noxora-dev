"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable"
import { useData } from "@/context/data-context"
import type { Task, TaskStatus, TaskFormData } from "@/types"
import { KanbanColumn } from "@/components/kanban/kanban-column"
import { KanbanCard } from "@/components/kanban/kanban-card"
import { TaskDialog } from "@/components/tasks/task-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Filter } from "lucide-react"

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "TODO", title: "To Do" },
  { status: "IN_PROGRESS", title: "In Progress" },
  { status: "REVIEW", title: "In Review" },
  { status: "COMPLETED", title: "Completed" },
]

export default function KanbanPage() {
  const {
    tasks,
    projects,
    isLoaded,
    addTask,
    updateTask,
    moveTask,
    reorderTasks,
    toggleTaskStatus,
    deleteTask,
  } = useData()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [projectFilter, setProjectFilter] = React.useState<string>("ALL")

  const [activeTask, setActiveTask] = React.useState<Task | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = React.useState<TaskStatus>("TODO")
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(null)

  // Attach safe client hooks for E2E and gap testing
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as {
        __NEXORA_MOVE_TASK__?: (taskId: string, targetStatus: TaskStatus) => void
        __NEXORA_REORDER_TASKS__?: (newTasks: Task[]) => void
      }
      win.__NEXORA_MOVE_TASK__ = moveTask
      win.__NEXORA_REORDER_TASKS__ = reorderTasks
    }
  }, [moveTask, reorderTasks])

  // Configure sensors: PointerSensor with 5px distance prevents accidental drag on clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Filter tasks based on search and project
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesProject =
        projectFilter === "ALL"
          ? true
          : projectFilter === "UNASSIGNED"
          ? task.projectId === null
          : task.projectId === projectFilter

      return matchesSearch && matchesProject
    })
  }, [tasks, searchQuery, projectFilter])

  // Partition tasks by column status
  const tasksByStatus = React.useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      COMPLETED: [],
    }

    filteredTasks.forEach((task) => {
      if (map[task.status]) {
        map[task.status].push(task)
      }
    })

    return map
  }, [filteredTasks])

  // Handlers for drag and drop
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = tasks.find((t) => t.id === active.id)
    if (task) {
      setActiveTask(task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) return

    // Find active task
    const activeCurrent = tasks.find((t) => t.id === activeId)
    if (!activeCurrent) return

    // Check if over a column directly
    const isOverColumn = COLUMNS.some((col) => col.status === overId)
    if (isOverColumn) {
      const newStatus = overId as TaskStatus
      if (activeCurrent.status !== newStatus) {
        moveTask(activeId, newStatus)
      }
      return
    }

    // Over another task
    const overTask = tasks.find((t) => t.id === overId)
    if (overTask && activeCurrent.status !== overTask.status) {
      moveTask(activeId, overTask.status)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) return

    const activeIndex = tasks.findIndex((t) => t.id === activeId)
    const overIndex = tasks.findIndex((t) => t.id === overId)

    if (activeIndex !== -1 && overIndex !== -1) {
      const reordered = arrayMove(tasks, activeIndex, overIndex)
      reorderTasks(reordered)
    }
  }

  // Task Dialog Actions
  const handleAddTaskToColumn = (status: TaskStatus) => {
    setEditingTask(null)
    setDefaultStatus(status)
    setTaskDialogOpen(true)
  }

  const handleCreateNewTask = () => {
    setEditingTask(null)
    setDefaultStatus("TODO")
    setTaskDialogOpen(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setTaskDialogOpen(true)
  }

  const handleDialogSubmit = (data: TaskFormData) => {
    if (editingTask) {
      updateTask(editingTask.id, data)
    } else {
      addTask({
        ...data,
        status: data.status || defaultStatus,
      })
    }
  }

  const handleDeleteConfirm = () => {
    if (deletingTaskId) {
      deleteTask(deletingTaskId)
      setDeletingTaskId(null)
    }
  }

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-[500px] rounded-2xl" />
          <Skeleton className="h-[500px] rounded-2xl" />
          <Skeleton className="h-[500px] rounded-2xl" />
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kanban Board
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag and drop tasks between workflow stages to update team progress.
          </p>
        </div>
        <Button onClick={handleCreateNewTask} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* ── Filter Controls ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search board tasks..."
              className="pl-9"
            />
          </div>

          {/* Project filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filter tasks by project"
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All Projects</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {(searchQuery || projectFilter !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setProjectFilter("ALL")
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <span className="text-xs text-muted-foreground self-end sm:self-auto font-medium">
          {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"} across 4 stages
        </span>
      </div>

      {/* ── DndContext Board ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className="overflow-x-auto pb-4 pt-1 scroll-smooth"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex gap-4 min-w-[1140px] items-start">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                title={col.title}
                tasks={tasksByStatus[col.status]}
                projects={projects}
                onAddTask={handleAddTaskToColumn}
                onEditTask={handleEditTask}
                onDeleteTask={(id) => setDeletingTaskId(id)}
                onToggleTask={toggleTaskStatus}
              />
            ))}
          </div>
        </div>

        {/* Drag Overlay card representation */}
        <DragOverlay>
          {activeTask ? (
            <KanbanCard
              task={activeTask}
              projects={projects}
              onEdit={() => {}}
              onDelete={() => {}}
              onToggle={() => {}}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        projects={projects}
        onSubmit={handleDialogSubmit}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingTaskId}
        onOpenChange={(open) => !open && setDeletingTaskId(null)}
        title="Delete Task?"
        description="Are you sure you want to delete this task? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
