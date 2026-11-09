"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  taskDates?: Set<string> // Format: "YYYY-MM-DD"
  overdueDates?: Set<string>
}

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  taskDates,
  overdueDates,
  ...props
}: CalendarProps) {
  // Modifiers for dates that have tasks or overdue items (timezone-safe local key)
  const modifiers = React.useMemo(() => {
    const toLocalKey = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return `${year}-${month}-${day}`
    }

    return {
      hasTask: (date: Date) => {
        if (!taskDates) return false
        return taskDates.has(toLocalKey(date))
      },
      hasOverdue: (date: Date) => {
        if (!overdueDates) return false
        return overdueDates.has(toLocalKey(date))
      },
    }
  }, [taskDates, overdueDates])

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 select-none", className)}
      modifiers={modifiers}
      modifiersClassNames={{
        hasTask: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-primary",
        hasOverdue: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-rose-500",
      }}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 w-full",
        month_caption: "flex justify-between items-center px-1 font-semibold text-sm text-foreground",
        caption_label: "text-sm font-semibold",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 text-muted-foreground hover:text-foreground opacity-80 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 text-muted-foreground hover:text-foreground opacity-80 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between text-muted-foreground text-xs",
        weekday: "text-muted-foreground w-9 font-medium text-[0.8rem] text-center",
        weeks: "space-y-1 mt-2",
        week: "flex w-full justify-between",
        day: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal rounded-lg hover:bg-muted text-foreground transition-colors relative flex items-center justify-center"
        ),
        selected: "!bg-primary !text-primary-foreground font-semibold rounded-lg shadow-sm hover:!bg-primary",
        today: "border border-primary/70 font-semibold text-primary",
        outside: "text-muted-foreground/30 opacity-40 hover:opacity-70",
        disabled: "text-muted-foreground/30 opacity-30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
