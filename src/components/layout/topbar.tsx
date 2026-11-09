"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { SyncIndicator } from "@/components/layout/sync-indicator"
import { MobileNav } from "@/components/layout/mobile-nav"
import { useData } from "@/context/data-context"

// ─── Page title map ───────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects":  "Projects",
  "/tasks":     "Tasks",
  "/kanban":    "Kanban",
  "/calendar":  "Calendar",
  "/notes":     "Notes",
  "/settings":  "Settings",
}

export function Topbar() {
  const pathname = usePathname()
  const { profile } = useData()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Derive title from first path segment (handles /projects/[id] → "Projects")
  const basePath = "/" + (pathname.split("/")[1] ?? "")
  const pageTitle = PAGE_TITLES[basePath] ?? "NEXORA DevHub"

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Mobile hamburger — hidden on lg+ (sidebar handles navigation) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Page title */}
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {pageTitle}
          </h1>
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <ThemeToggle />
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground font-medium">
              {profile.initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Mobile navigation sheet */}
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </>
  )
}
