import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  indicatorColor?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorColor, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value || 0))
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 transition-all duration-300",
            !indicatorColor && "bg-primary"
          )}
          style={{
            transform: `translateX(-${100 - clamped}%)`,
            backgroundColor: indicatorColor,
          }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
