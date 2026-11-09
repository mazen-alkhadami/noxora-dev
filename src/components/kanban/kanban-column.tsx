"use client"

import * as React from "react"
import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import type { Task, TaskStatus, Project } from "@/types"
import { KanbanCard } from "./kanban-card"
import { Button } from "@/components/ui/button"
import { Plus, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

interface KanbanColumnProps {
  status: TaskStatus
  title: string
  tasks: Task[]
  projects: Project[]
  onAddTask: (status: TaskStatus) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (id: string) => void
  onToggleTask: (id: string) => void
}

const columnStyles: Record<
  TaskStatus,
  { dot: string; border: string; headerBg: string }
> = {
  TODO: {
    dot: "bg-zinc-400 dark:bg-zinc-500",
    border: "border-zinc-500/20",
    headerBg: "bg-zinc-500/5",
  },
  IN_PROGRESS: {
    dot: "bg-blue-500",
    border: "border-blue-500/20",
    headerBg: "bg-blue-500/5",
  },
  REVIEW: {
    dot: "bg-purple-500",
    border: "border-purple-500/20",
    headerBg: "bg-purple-500/5",
  },
  COMPLETED: {
    dot: "bg-emerald-500",
    border: "border-emerald-500/20",
    headerBg: "bg-emerald-500/5",
  },
}

export function KanbanColumn({
  status,
  title,
  tasks,
  projects,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
  })

  const style = columnStyles[status]
  const taskIds = React.useMemo(() => tasks.map((t) => t.id), [tasks])

  return (
    <div
      ref={setNodeRef}
      data-status={status}
      className={cn(
        "flex h-full min-w-[280px] sm:min-w-[300px] w-full max-w-[360px] flex-col rounded-2xl border bg-muted/20 transition-colors",
        style.border,
        isOver && "ring-2 ring-primary/40 bg-primary/5"
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3 rounded-t-2xl",
          style.border,
          style.headerBg
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", style.dot)} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {title}
          </h3>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/80"
          onClick={() => onAddTask(status)}
          title={`Add task to ${title}`}
          aria-label={`Add task to ${title}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Column Task Area */}
      <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto min-h-[380px] max-h-[calc(100vh-250px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              projects={projects}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onToggle={onToggleTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-8 text-center text-muted-foreground/60">
            <Inbox className="h-6 w-6 stroke-[1.5] mb-2 text-muted-foreground/40" />
            <p className="text-xs font-medium">No tasks</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Drop items here or click + to add
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
