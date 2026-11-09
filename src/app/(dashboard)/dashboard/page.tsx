"use client"

import * as React from "react"
import Link from "next/link"
import {
  FolderKanban,
  CheckSquare,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity as ActivityIcon,
  Calendar as CalendarIcon,
  CheckCircle2,
} from "lucide-react"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { TaskDialog } from "@/components/tasks/task-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const {
    projects,
    tasks,
    activities,
    profile,
    isLoaded,
    addProject,
    addTask,
    toggleTaskStatus,
    getProjectTasks,
    getProjectProgress,
  } = useData()

  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false)

  const firstName = profile?.name ? profile.name.trim().split(" ")[0] : "Developer"

  // Calculated Stats
  const activeProjectsCount = projects.filter((p) => p.status === "ACTIVE").length
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length
  const pendingTasks = totalTasks - completedTasks
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Deadlines: tasks with due dates, sorted soonest first, incomplete first
  const upcomingDeadlines = React.useMemo(() => {
    return tasks
      .filter((t) => t.dueDate && t.status !== "COMPLETED")
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5)
  }, [tasks])

  // Recent Projects (up to 4)
  const recentProjects = React.useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4)
  }, [projects])

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Welcome Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {firstName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here is what&apos;s happening with your workspace and projects today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProjectDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
          <Button
            size="sm"
            onClick={() => setTaskDialogOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Projects */}
        <Card className="hover:border-border/80 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Projects
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <FolderKanban className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {activeProjectsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>{projects.length} total projects</span>
            </p>
          </CardContent>
        </Card>

        {/* Total Tasks */}
        <Card className="hover:border-border/80 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Tasks
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <CheckSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalTasks}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>{pendingTasks} remaining</span>
            </p>
          </CardContent>
        </Card>

        {/* Completed Tasks */}
        <Card className="hover:border-border/80 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Completion Rate
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{completionRate}%</div>
            <div className="mt-2">
              <Progress value={completionRate} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines Count */}
        <Card className="hover:border-border/80 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Upcoming Deadlines
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {upcomingDeadlines.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires attention soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Section: Projects + Deadlines & Activity ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols): Recent Projects */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Recent Projects</h3>
            <Link
              href="/projects"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              View all ({projects.length})
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentProjects.length === 0 ? (
              <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
                <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="font-semibold text-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Create your first project to start tracking team initiatives.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProjectDialogOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Project
                </Button>
              </Card>
            ) : (
              recentProjects.map((project) => {
              const projectTasks = getProjectTasks(project.id)
              const progress = getProjectProgress(project.id)
              const completedCount = projectTasks.filter(
                (t) => t.status === "COMPLETED"
              ).length

              return (
                <Card
                  key={project.id}
                  className="group hover:border-border/80 transition-all shadow-sm flex flex-col justify-between"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <h4 className="font-semibold text-foreground truncate text-sm">
                          {project.name}
                        </h4>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                      {project.description || "No description provided."}
                    </p>
                  </CardHeader>

                  <CardContent className="p-5 pt-0">
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span className="font-medium text-foreground">
                          {completedCount}/{projectTasks.length} tasks ({progress}%)
                        </span>
                      </div>
                      <Progress
                        value={progress}
                        indicatorColor={project.color}
                        className="h-1.5"
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })
            )}
          </div>

          {/* Upcoming Deadlines List */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Upcoming Deadlines
              </h3>
              <Link
                href="/tasks"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                View all tasks
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No upcoming deadlines. You&apos;re completely up to date!
              </Card>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((task) => {
                  const proj = projects.find((p) => p.id === task.projectId)
                  const isOverdue =
                    new Date(task.dueDate!).getTime() < new Date().setHours(0, 0, 0, 0)

                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleTaskStatus(task.id)}
                          aria-label={`Mark "${task.title}" as complete`}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-input hover:border-primary text-transparent hover:text-muted-foreground transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {proj && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: proj.color }}
                                />
                                {proj.name}
                              </span>
                            )}
                            {proj && <span>•</span>}
                            <span
                              className={cn(
                                "flex items-center gap-1",
                                isOverdue && "text-rose-500 font-medium"
                              )}
                            >
                              <CalendarIcon className="h-3 w-3" />
                              {new Date(task.dueDate!).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                              {isOverdue && " (Overdue)"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col): Recent Activity Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ActivityIcon className="h-3 w-3" />
              Live log
            </span>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="relative pl-6 space-y-4 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[1px] before:bg-border">
                {activities.slice(0, 7).map((activity) => (
                  <div key={activity.id} className="relative group">
                    <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-primary" />
                    <div>
                      <p className="text-xs font-medium text-foreground leading-snug">
                        {activity.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        {new Date(activity.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onSubmit={addProject}
      />
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        projects={projects}
        onSubmit={addTask}
      />
    </div>
  )
}
