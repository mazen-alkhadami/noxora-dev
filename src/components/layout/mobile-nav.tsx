"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Kanban,
  Calendar,
  FileText,
  Settings,
  Zap,
  LogOut,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import type { NavItem } from "@/types"

// ─── Navigation config (mirrors sidebar.tsx) ─────────────────────────────────

const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard",  icon: LayoutDashboard },
  { label: "Projects",  href: "/projects",   icon: FolderKanban    },
  { label: "Tasks",     href: "/tasks",      icon: CheckSquare     },
  { label: "Kanban",    href: "/kanban",     icon: Kanban          },
  { label: "Calendar",  href: "/calendar",   icon: Calendar        },
  { label: "Notes",     href: "/notes",      icon: FileText        },
  { label: "Settings",  href: "/settings",   icon: Settings        },
]

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

/**
 * MobileNav — Sheet-based slide-in drawer for screens < lg (1024px).
 * Triggered by the hamburger button in the Topbar.
 * Automatically closes when the user navigates to a new route.
 */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
        {/* Header */}
        <SheetHeader className="flex-row h-14 items-center border-b border-sidebar-border px-4">
          <SheetTitle asChild>
            <Link
              href="/dashboard"
              onClick={onClose}
              className="flex items-center gap-2.5"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                NEXORA
              </span>
            </Link>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Mobile navigation menu for NEXORA DevHub
          </SheetDescription>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-3" aria-label="Mobile navigation">
          {ALL_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/")

            // Insert a separator before Settings
            const isSettings = item.href === "/settings"

            return (
              <div key={item.href}>
                {isSettings && <Separator className="my-2 bg-sidebar-border" />}
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    "transition-colors duration-150",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </div>
            )
          })}
          <div className="pt-2">
            <button
              onClick={() => {
                onClose()
                signOut({ callbackUrl: "/login" })
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Sign Out
            </button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
