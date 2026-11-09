"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Task, Project } from "@/types"
import { PriorityBadge } from "@/components/shared/priority-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  GripVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface KanbanCardProps {
  task: Task
  projects: Project[]
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  isOverlay?: boolean
}

export function KanbanCard({
  task,
  projects,
  onEdit,
  onDelete,
  onToggle,
  isOverlay = false,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isOverlay,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const proj = projects.find((p) => p.id === task.projectId)
  const isCompleted = task.status === "COMPLETED"
  const isOverdue =
    task.dueDate &&
    !isCompleted &&
    new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={task.id}
      data-task-status={task.status}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 shadow-xs transition-all duration-150",
        "hover:border-border/80 hover:shadow-sm",
        isDragging && "opacity-40 border-dashed border-primary/50",
        isOverlay && "cursor-grabbing shadow-xl ring-2 ring-primary/40 rotate-1 scale-[1.02] opacity-95",
        isCompleted && "bg-card/60"
      )}
    >
      {/* Top Header: Priority, Drag grip & Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 group-hover:text-muted-foreground p-0.5 rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors"
            title="Drag task"
            aria-label={`Drag task: ${task.title}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <PriorityBadge priority={task.priority} />
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
                aria-label={`More options for ${task.title}`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(task)
                }}
              >
                <Edit2 className="mr-2 h-3.5 w-3.5" />
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(task.id)
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content: Title & Description */}
      <div className="mt-2.5 space-y-1">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(task.id)
            }}
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors",
              isCompleted
                ? "text-primary"
                : "border border-input text-transparent hover:border-primary hover:text-muted-foreground"
            )}
            title={isCompleted ? "Mark incomplete" : "Mark complete"}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
          <h4
            className={cn(
              "text-xs font-semibold text-foreground leading-snug break-words",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </h4>
        </div>

        {task.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 pl-6 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Footer: Project label & Due date */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
        {proj ? (
          <span className="flex items-center gap-1.5 font-medium text-foreground truncate max-w-[140px]">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: proj.color }}
            />
            <span className="truncate">{proj.name}</span>
          </span>
        ) : (
          <span className="italic text-muted-foreground/70">No project</span>
        )}

        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 font-medium",
              isOverdue ? "text-rose-500 font-semibold" : "text-muted-foreground"
            )}
          >
            <Calendar className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  )
}
