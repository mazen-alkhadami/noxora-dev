"use client"

import * as React from "react"
import {
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  CheckSquare,
} from "lucide-react"
import { useData } from "@/context/data-context"
import type { Task, TaskStatus, Priority, TaskFormData } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { TaskDialog } from "@/components/tasks/task-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function TasksPage() {
  const {
    tasks,
    projects,
    isLoaded,
    addTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
  } = useData()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "ALL">("ALL")
  const [priorityFilter, setPriorityFilter] = React.useState<Priority | "ALL">("ALL")
  const [projectFilter, setProjectFilter] = React.useState<string>("ALL")

  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(null)

  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus =
        statusFilter === "ALL" ? true : task.status === statusFilter
      const matchesPriority =
        priorityFilter === "ALL" ? true : task.priority === priorityFilter
      const matchesProject =
        projectFilter === "ALL"
          ? true
          : projectFilter === "UNASSIGNED"
          ? task.projectId === null
          : task.projectId === projectFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesProject
    })
  }, [tasks, searchQuery, statusFilter, priorityFilter, projectFilter])

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setTaskDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingTask(null)
    setTaskDialogOpen(true)
  }

  const handleDialogSubmit = (data: TaskFormData) => {
    if (editingTask) {
      updateTask(editingTask.id, data)
    } else {
      addTask(data)
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
        <div className="flex gap-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
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
            Tasks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track, filter, and manage your operational work items across projects.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* ── Filter Controls ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9"
          />
        </div>

        {/* Dropdowns / Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "ALL")}
            aria-label="Filter by status"
            className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVIEW">In Review</option>
            <option value="COMPLETED">Completed</option>
          </select>

          {/* Priority Select */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | "ALL")}
            aria-label="Filter by priority"
            className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          {/* Project Select */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            aria-label="Filter by project"
            className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Projects</option>
            <option value="UNASSIGNED">Unassigned</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {(statusFilter !== "ALL" ||
            priorityFilter !== "ALL" ||
            projectFilter !== "ALL" ||
            searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("ALL")
                setPriorityFilter("ALL")
                setProjectFilter("ALL")
                setSearchQuery("")
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* ── Task List ── */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={searchQuery ? "No matching tasks" : "No tasks found"}
          description={
            searchQuery
              ? `No tasks matched your search or active filters.`
              : "Keep your productivity on track by creating a new task."
          }
          action={
            <Button onClick={handleCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED"
            const proj = projects.find((p) => p.id === task.projectId)
            const isOverdue =
              task.dueDate &&
              !isCompleted &&
              new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)

            return (
              <div
                key={task.id}
                className={cn(
                  "group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:border-border/80 transition-all shadow-xs",
                  isCompleted && "opacity-70 bg-card/60"
                )}
              >
                {/* Checkbox and task info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleTaskStatus(task.id)}
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:border-primary text-transparent hover:text-muted-foreground"
                    )}
                    aria-label={
                      isCompleted
                        ? `Mark "${task.title}" as incomplete`
                        : `Mark "${task.title}" as completed`
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>

                  <div className="min-w-0">
                    <h4
                      className={cn(
                        "text-sm font-semibold text-foreground truncate",
                        isCompleted && "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                      {proj ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: proj.color }}
                          />
                          {proj.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          No project
                        </span>
                      )}

                      {task.dueDate && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px]",
                            isOverdue ? "text-rose-500 font-semibold" : "text-muted-foreground"
                          )}
                        >
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {isOverdue && " (Overdue)"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right controls: Badges and Action Menu */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        aria-label={`More options for ${task.title}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(task)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeletingTaskId(task.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        projects={projects}
        onSubmit={handleDialogSubmit}
      />

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
