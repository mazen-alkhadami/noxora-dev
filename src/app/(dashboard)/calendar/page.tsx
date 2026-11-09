"use client"

import * as React from "react"
import { useData } from "@/context/data-context"
import type { Task, TaskFormData } from "@/types"
import { Calendar } from "@/components/ui/calendar"
import { CalendarDayPanel } from "@/components/calendar/calendar-day-panel"
import { TaskDialog } from "@/components/tasks/task-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Filter,
  AlertTriangle,
} from "lucide-react"

export default function CalendarPage() {
  const {
    tasks,
    projects,
    isLoaded,
    addTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
  } = useData()

  const [selectedDate, setSelectedDate] = React.useState<Date>(() => new Date())
  const [projectFilter, setProjectFilter] = React.useState<string>("ALL")

  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [defaultDueDate, setDefaultDueDate] = React.useState<string>("")
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(null)

  // Filter tasks based on project filter
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      if (projectFilter === "ALL") return true
      if (projectFilter === "UNASSIGNED") return t.projectId === null
      return t.projectId === projectFilter
    })
  }, [tasks, projectFilter])

  // Helper to get YYYY-MM-DD in local time
  const toDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // Set of dates that have tasks
  const { taskDates, overdueDates } = React.useMemo(() => {
    const taskSet = new Set<string>()
    const overdueSet = new Set<string>()
    const todayMidnight = new Date().setHours(0, 0, 0, 0)

    filteredTasks.forEach((task) => {
      if (task.dueDate) {
        const key = task.dueDate.split("T")[0]!
        taskSet.add(key)

        const d = new Date(task.dueDate)
        if (task.status !== "COMPLETED" && d.getTime() < todayMidnight) {
          overdueSet.add(key)
        }
      }
    })

    return { taskDates: taskSet, overdueDates: overdueSet }
  }, [filteredTasks])

  // Tasks for selected day
  const selectedDayTasks = React.useMemo(() => {
    const targetKey = toDateKey(selectedDate)
    return filteredTasks.filter((t) => {
      if (!t.dueDate) return false
      return t.dueDate.split("T")[0] === targetKey
    })
  }, [filteredTasks, selectedDate])

  // Overdue count
  const overdueCount = React.useMemo(() => {
    const todayMidnight = new Date().setHours(0, 0, 0, 0)
    return filteredTasks.filter(
      (t) => t.dueDate && t.status !== "COMPLETED" && new Date(t.dueDate).getTime() < todayMidnight
    ).length
  }, [filteredTasks])

  // Task Dialog handlers
  const handleAddTaskForDate = (date: Date) => {
    setEditingTask(null)
    setDefaultDueDate(toDateKey(date))
    setTaskDialogOpen(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setDefaultDueDate("")
    setTaskDialogOpen(true)
  }

  const handleDialogSubmit = (data: TaskFormData) => {
    if (editingTask) {
      updateTask(editingTask.id, data)
    } else {
      addTask({
        ...data,
        dueDate: data.dueDate || (defaultDueDate ? new Date(defaultDueDate).toISOString() : null),
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="h-[460px] rounded-2xl lg:col-span-7" />
          <Skeleton className="h-[460px] rounded-2xl lg:col-span-5" />
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
            Calendar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule deliverables, track milestone deadlines, and manage your monthly calendar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleAddTaskForDate(selectedDate)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Schedule Task
          </Button>
        </div>
      </div>

      {/* ── Top Bar: Filter & Overdue Warning ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            aria-label="Filter calendar by project"
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

          {projectFilter !== "ALL" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProjectFilter("ALL")}
              className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
            >
              Reset
            </Button>
          )}
        </div>

        {overdueCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{overdueCount} overdue {overdueCount === 1 ? "task" : "tasks"} requires action</span>
          </div>
        )}
      </div>

      {/* ── 2-Column Calendar & Day Panel Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Calendar Card */}
        <Card className="lg:col-span-7 xl:col-span-8 shadow-xs border-border">
          <CardContent className="p-4 sm:p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              taskDates={taskDates}
              overdueDates={overdueDates}
              className="w-full flex justify-center"
            />

            {/* Calendar Legend */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-5 border-t border-border/50 pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span>Scheduled Task</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Overdue Task</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded border border-primary/70" />
                <span>Today</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Selected Day Tasks Panel */}
        <div className="lg:col-span-5 xl:col-span-4 min-h-[480px]">
          <CalendarDayPanel
            selectedDate={selectedDate}
            tasks={selectedDayTasks}
            projects={projects}
            onAddTask={handleAddTaskForDate}
            onEditTask={handleEditTask}
            onDeleteTask={(id) => setDeletingTaskId(id)}
            onToggleTask={toggleTaskStatus}
          />
        </div>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        projects={projects}
        onSubmit={handleDialogSubmit}
      />

      {/* Confirm Deletion Dialog */}
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
