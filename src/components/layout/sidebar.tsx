"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Kanban,
  Calendar,
  FileText,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/hooks/use-sidebar"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { NavItem } from "@/types"

// ─── Navigation config ───────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard",  icon: LayoutDashboard },
  { label: "Projects",  href: "/projects",   icon: FolderKanban    },
  { label: "Tasks",     href: "/tasks",      icon: CheckSquare     },
  { label: "Kanban",    href: "/kanban",     icon: Kanban          },
  { label: "Calendar",  href: "/calendar",   icon: Calendar        },
  { label: "Notes",     href: "/notes",      icon: FileText        },
]

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "Settings",  href: "/settings",   icon: Settings        },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

interface NavLinkProps {
  item: NavItem
  isCollapsed: boolean
  isActive: boolean
}

function NavLink({ item, isCollapsed, isActive }: NavLinkProps) {
  const Icon = item.icon

  const linkEl = (
    <Link
      href={item.href}
      className={cn(
        // Base
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
        "transition-colors duration-150",
        // Collapsed: icon-only, centered
        isCollapsed && "justify-center px-2",
        // States
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {!isCollapsed && <span>{item.label}</span>}
    </Link>
  )

  // In icon-only mode, wrap with a tooltip showing the label
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkEl
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const { isCollapsed, toggle, mounted } = useSidebar()
  const { profile } = useData()
  const pathname = usePathname()

  // Avoid layout shift on first render by using server-side default (expanded)
  // `mounted` becomes true after useEffect runs on the client
  const collapsed = mounted ? isCollapsed : false

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex h-full flex-col border-r border-sidebar-border bg-sidebar",
          "transition-[width] duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* ── Header: Logo + collapse button ── */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-sidebar-border px-4",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            {/* Logo mark — always visible */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            {/* Wordmark — hidden when collapsed */}
            {!collapsed && (
              <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                NEXORA
              </span>
            )}
          </Link>

          {/* Collapse toggle — only shown in expanded state */}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* ── Main navigation ── */}
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-1 p-3" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <NavLink
                  key={item.href}
                  item={item}
                  isCollapsed={collapsed}
                  isActive={isActive}
                />
              )
            })}
          </nav>
        </ScrollArea>

        {/* ── Bottom section: Settings + User ── */}
        <div className="shrink-0 p-3">
          <Separator className="mb-3 bg-sidebar-border" />

          {/* Settings link */}
          <nav className="mb-3" aria-label="Secondary navigation">
            {BOTTOM_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isCollapsed={collapsed}
                isActive={pathname === item.href}
              />
            ))}
          </nav>

          {/* User section */}
          {collapsed ? (
            /* Collapsed: avatar only with tooltip */
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-7 w-7 cursor-pointer">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {profile.initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{profile.name}</p>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                </TooltipContent>
              </Tooltip>

              {/* Expand button when collapsed */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggle}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Expand sidebar"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            /* Expanded: full user row */
            <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {profile.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-sidebar-foreground leading-tight">
                  {profile.name}
                </p>
                <p className="truncate text-xs text-muted-foreground leading-tight mt-0.5">
                  {profile.email}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
