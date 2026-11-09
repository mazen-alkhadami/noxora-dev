import { cn } from "@/lib/utils"
import type { Priority } from "@/types"
import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react"

interface PriorityBadgeProps {
  priority: Priority
  className?: string
  showIcon?: boolean
}

const priorityConfig: Record<
  Priority,
  {
    label: string
    bg: string
    text: string
    icon: typeof ArrowDown
  }
> = {
  LOW: {
    label: "Low",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    text: "text-zinc-600 dark:text-zinc-400",
    icon: ArrowDown,
  },
  MEDIUM: {
    label: "Medium",
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    icon: ArrowUp,
  },
  HIGH: {
    label: "High",
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
  },
  URGENT: {
    label: "Urgent",
    bg: "bg-rose-500/10 border-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
    icon: AlertCircle,
  },
}

export function PriorityBadge({
  priority,
  className,
  showIcon = true,
}: PriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.MEDIUM
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      {config.label}
    </span>
  )
}
