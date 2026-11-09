"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useData } from "@/context/data-context"
import type { UserPreferences } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  User,
  Palette,
  Sliders,
  Database,
  Sun,
  Moon,
  Monitor,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { profile, preferences, isLoaded, updateProfile, updatePreferences, resetAllData } = useData()

  // Profile Form State
  const [name, setName] = React.useState(profile.name)
  const [title, setTitle] = React.useState(profile.title)
  const [profileSaved, setProfileSaved] = React.useState(false)

  // Reset Confirmation State
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false)
  const [resetSuccess, setResetSuccess] = React.useState(false)

  React.useEffect(() => {
    if (isLoaded) {
      setName(profile.name)
      setTitle(profile.title)
    }
  }, [profile, isLoaded])

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    updateProfile({
      name: name.trim(),
      title: title.trim(),
    })
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  const handleResetConfirm = () => {
    resetAllData()
    setResetDialogOpen(false)
    setResetSuccess(true)
    setTimeout(() => setResetSuccess(false), 3000)
  }

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
        <div className="space-y-6 pt-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      {/* ── Page Header ── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account profile, theme preferences, and local application data.
        </p>
      </div>

      {/* ── Section 1: Profile ── */}
      <Card className="rounded-2xl shadow-xs border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">User Profile</CardTitle>
          </div>
          <CardDescription>
            Personalize your display credentials across team views and activity logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Avatar Row */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-border shadow-xs">
                <AvatarFallback className="text-lg bg-primary text-primary-foreground font-semibold">
                  {profile.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{profile.name}</h4>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Local Session Account
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-name"
                  className="text-xs font-semibold text-foreground uppercase tracking-wider"
                >
                  Full Name
                </label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Vance"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-title"
                  className="text-xs font-semibold text-foreground uppercase tracking-wider"
                >
                  Professional Title / Role
                </label>
                <Input
                  id="profile-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lead Full-Stack Engineer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profile-email"
                className="text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Email Address
              </label>
              <Input
                id="profile-email"
                value={profile.email}
                disabled
                className="opacity-70 bg-muted/30 cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">
                Email authentication is securely managed with your account credentials.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" size="sm" className="gap-1.5">
                Save Changes
              </Button>
              {profileSaved && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  <Check className="h-3.5 w-3.5" />
                  Profile updated successfully
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Section 2: Appearance (Theme) ── */}
      <Card className="rounded-2xl shadow-xs border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Appearance</CardTitle>
          </div>
          <CardDescription>
            Customize the visual appearance and contrast mode of the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Light Mode */}
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex flex-col items-start justify-between rounded-xl border p-4 text-left transition-all",
                theme === "light"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-border/80 hover:bg-muted/30"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 mb-3">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Light Mode</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Clean daytime contrast with zinc surfaces.
                </p>
              </div>
            </button>

            {/* Dark Mode */}
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex flex-col items-start justify-between rounded-xl border p-4 text-left transition-all",
                theme === "dark"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-border/80 hover:bg-muted/30"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 mb-3">
                <Moon className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Dark Mode</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Deep zinc palette designed for low-light coding.
                </p>
              </div>
            </button>

            {/* System */}
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={cn(
                "flex flex-col items-start justify-between rounded-xl border p-4 text-left transition-all",
                theme === "system"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-border/80 hover:bg-muted/30"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mb-3">
                <Monitor className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">System Match</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Automatically syncs with your operating system.
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Interface Preferences ── */}
      <Card className="rounded-2xl shadow-xs border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Workspace Preferences</CardTitle>
          </div>
          <CardDescription>
            Configure default navigation behavior and interface density.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Default Landing View */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              <h4 className="text-xs font-bold text-foreground">Default View</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Preferred startup section when accessing the dev hub.
              </p>
            </div>
            <select
              value={preferences.defaultView}
              onChange={(e) =>
                updatePreferences({
                  defaultView: e.target.value as UserPreferences["defaultView"],
                })
              }
              aria-label="Default View"
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-ring w-44"
            >
              <option value="dashboard">Dashboard</option>
              <option value="kanban">Kanban Board</option>
              <option value="tasks">Tasks View</option>
              <option value="calendar">Calendar</option>
            </select>
          </div>

          {/* Task Density */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              <h4 className="text-xs font-bold text-foreground">Task Display Density</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Controls vertical padding on tasks and list items.
              </p>
            </div>
            <select
              value={preferences.taskDensity}
              onChange={(e) =>
                updatePreferences({
                  taskDensity: e.target.value as UserPreferences["taskDensity"],
                })
              }
              aria-label="Task Display Density"
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-ring w-44"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          {/* Confirmation Dialogs */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-foreground">Delete Confirmations</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Always prompt confirmation modals before deleting records.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Confirm before deleting records"
              aria-checked={preferences.confirmBeforeDelete}
              onClick={() =>
                updatePreferences({
                  confirmBeforeDelete: !preferences.confirmBeforeDelete,
                })
              }
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring",
                preferences.confirmBeforeDelete ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
                  preferences.confirmBeforeDelete ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Data Management (Reset) ── */}
      <Card className="rounded-2xl shadow-xs border-destructive/20 bg-destructive/5">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-destructive" />
            <CardTitle className="text-base font-semibold text-destructive">
              Demo Data Management
            </CardTitle>
          </div>
          <CardDescription>
            Restore initial demo datasets or reset all locally stored workspace records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">
                Reset Demo Workspace
              </p>
              <p className="text-[11px] text-muted-foreground max-w-md leading-relaxed">
                Reverts all projects, tasks, notes, and activity feeds back to the default factory
                sample data. Unrelated browser storage remains unaffected.
              </p>
            </div>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              className="gap-1.5 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Demo Data
            </Button>
          </div>

          {resetSuccess && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Workspace demo data has been restored to default seed values.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset All Workspace Data?"
        description="This will restore the initial sample dataset (6 projects, 20 tasks, 4 notes) and replace any modifications you've made. This action cannot be reversed."
        confirmText="Reset Data"
        onConfirm={handleResetConfirm}
      />
    </div>
  )
}
