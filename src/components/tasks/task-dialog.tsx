"use client"

import * as React from "react"
import type { Task, TaskFormData, TaskStatus, Priority, Project } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  projects: Project[]
  defaultProjectId?: string | null
  onSubmit: (data: TaskFormData) => void
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  projects,
  defaultProjectId,
  onSubmit,
}: TaskDialogProps) {
  const isEditing = !!task

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [projectId, setProjectId] = React.useState<string>("")
  const [status, setStatus] = React.useState<TaskStatus>("TODO")
  const [priority, setPriority] = React.useState<Priority>("MEDIUM")
  const [dueDate, setDueDate] = React.useState("")
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
      setProjectId(task.projectId || "")
      setStatus(task.status)
      setPriority(task.priority)
      setDueDate(task.dueDate ? task.dueDate.split("T")[0] || "" : "")
    } else {
      setTitle("")
      setDescription("")
      setProjectId(defaultProjectId || "")
      setStatus("TODO")
      setPriority("MEDIUM")
      setDueDate("")
    }
    setError("")
  }, [task, defaultProjectId, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError("Task title is required")
      return
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      projectId: projectId || null,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Task" : "New Task"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update task details, deadline, or priority."
                : "Create a new task to track progress."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label
                htmlFor="task-title"
                className="text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Task Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (error) setError("")
                }}
                placeholder="e.g. Implement authentication flow"
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="task-desc"
                className="text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Description
              </label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details or acceptance criteria for this task"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="task-project"
                  className="text-xs font-semibold text-foreground uppercase tracking-wider"
                >
                  Project
                </label>
                <select
                  id="task-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">No Project (General)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="task-priority"
                  className="text-xs font-semibold text-foreground uppercase tracking-wider"
                >
                  Priority
                </label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="task-status"
                  className="text-xs font-semibold text-foreground uppercase tracking-wider"
                >
                  Status
                </label>
                <select
                  id="task-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REVIEW">In Review</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="task-due-date"
                  className="text-xs font-semibold text-foreground uppercase tracking-wider"
                >
                  Due Date
                </label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
