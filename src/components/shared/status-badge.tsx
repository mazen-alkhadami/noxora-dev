import { cn } from "@/lib/utils"
import type { TaskStatus, ProjectStatus } from "@/types"

interface StatusBadgeProps {
  status: TaskStatus | ProjectStatus
  className?: string
}

const statusConfig: Record<
  TaskStatus | ProjectStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  TODO: {
    label: "To Do",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    text: "text-zinc-500 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  REVIEW: {
    label: "In Review",
    bg: "bg-purple-500/10 border-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  ACTIVE: {
    label: "Active",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  ON_HOLD: {
    label: "On Hold",
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  ARCHIVED: {
    label: "Archived",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    text: "text-zinc-500 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.TODO

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  )
}
