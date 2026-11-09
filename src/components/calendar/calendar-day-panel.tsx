"use client"

import * as React from "react"
import type { Task, Project } from "@/types"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  CheckCircle2,
  CalendarCheck,
  MoreVertical,
  Edit2,
  Trash2,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CalendarDayPanelProps {
  selectedDate: Date
  tasks: Task[]
  projects: Project[]
  onAddTask: (date: Date) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (id: string) => void
  onToggleTask: (id: string) => void
}

export function CalendarDayPanel({
  selectedDate,
  tasks,
  projects,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}: CalendarDayPanelProps) {
  const isToday =
    new Date(selectedDate).toDateString() === new Date().toDateString()

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-xs">
      {/* Panel Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-base">
              {formattedDate}
            </h3>
            {isToday && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Today
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} scheduled for this date
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => onAddTask(selectedDate)}
          className="gap-1.5 h-8 text-xs shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Task
        </Button>
      </div>

      {/* Task List or Empty State */}
      <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
        {tasks.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No tasks scheduled"
            description="There are no deadlines or tasks set for this day."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddTask(selectedDate)}
                className="gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Schedule Task
              </Button>
            }
            className="py-10 border-0 bg-transparent"
          />
        ) : (
          tasks.map((task) => {
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
                  "group flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5 transition-colors hover:border-border/80 hover:bg-muted/40",
                  isCompleted && "opacity-60 bg-muted/10"
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors",
                      isCompleted
                        ? "text-primary"
                        : "border border-input text-transparent hover:border-primary hover:text-muted-foreground"
                    )}
                    aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>

                  <div className="min-w-0">
                    <h4
                      className={cn(
                        "text-xs font-semibold text-foreground truncate",
                        isCompleted && "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
                      {proj && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: proj.color }}
                          />
                          {proj.name}
                        </span>
                      )}

                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />

                      {isOverdue && (
                        <span className="flex items-center gap-1 text-rose-500 font-semibold">
                          <Clock className="h-3 w-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditTask(task)}>
                      <Edit2 className="mr-2 h-3.5 w-3.5" />
                      Edit Task
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDeleteTask(task.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete Task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
