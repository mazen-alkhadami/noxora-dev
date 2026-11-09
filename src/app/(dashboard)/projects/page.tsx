"use client"

import * as React from "react"
import {
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  Edit2,
  Trash2,
  FolderOpen,
  CheckCircle2,
} from "lucide-react"
import { useData } from "@/context/data-context"
import type { Project, ProjectStatus, ProjectFormData } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function ProjectsPage() {
  const {
    projects,
    isLoaded,
    addProject,
    updateProject,
    deleteProject,
    getProjectTasks,
    getProjectProgress,
  } = useData()

  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<ProjectStatus | "ALL">("ALL")

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<Project | null>(null)
  const [deletingProjectId, setDeletingProjectId] = React.useState<string | null>(null)

  const filteredProjects = React.useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus =
        statusFilter === "ALL" ? true : project.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projects, searchQuery, statusFilter])

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingProject(null)
    setDialogOpen(true)
  }

  const handleDialogSubmit = (data: ProjectFormData) => {
    if (editingProject) {
      updateProject(editingProject.id, data)
    } else {
      addProject(data)
    }
  }

  const handleDeleteConfirm = () => {
    if (deletingProjectId) {
      deleteProject(deletingProjectId)
      setDeletingProjectId(null)
    }
  }

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Projects
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your project initiatives, monitor task progress, and adjust priorities.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* ── Controls: Search, Status Filter, View Toggle ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="pl-9"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/50 text-xs">
            {(["ALL", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-colors",
                    statusFilter === status
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {status === "ALL" ? "All" : status.replace("_", " ")}
                </button>
              )
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 self-end sm:self-auto border border-border rounded-lg p-1 bg-card">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "grid"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Grid view"
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "list"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="List view"
            aria-label="List view"
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Content View ── */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={searchQuery ? "No matching projects" : "No projects found"}
          description={
            searchQuery
              ? `No projects matched "${searchQuery}". Try adjusting your filters.`
              : "Get started by creating your very first project to organize your tasks."
          }
          action={
            <Button onClick={handleCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          }
        />
      ) : viewMode === "grid" ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const projectTasks = getProjectTasks(project.id)
            const progress = getProjectProgress(project.id)
            const completedCount = projectTasks.filter(
              (t) => t.status === "COMPLETED"
            ).length

            return (
              <Card
                key={project.id}
                className="group flex flex-col justify-between hover:border-border/80 transition-all shadow-sm hover:shadow"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-background"
                        style={{ backgroundColor: project.color }}
                      />
                      <h3 className="font-semibold text-foreground text-base truncate">
                        {project.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={project.status} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={`More options for ${project.name}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(project)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeletingProjectId(project.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                    {project.description || "No description provided."}
                  </p>
                </CardHeader>

                <CardContent className="p-5 pt-0">
                  <div className="space-y-3 pt-3 border-t border-border/50">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        {completedCount} of {projectTasks.length} tasks
                      </span>
                      <span className="font-semibold text-foreground">
                        {progress}%
                      </span>
                    </div>
                    <Progress
                      value={progress}
                      indicatorColor={project.color}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* ── List View ── */
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="divide-y divide-border">
            {filteredProjects.map((project) => {
              const projectTasks = getProjectTasks(project.id)
              const progress = getProjectProgress(project.id)
              const completedCount = projectTasks.filter(
                (t) => t.status === "COMPLETED"
              ).length

              return (
                <div
                  key={project.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {project.name}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {project.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                    <div className="w-36 space-y-1 hidden md:block">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{completedCount}/{projectTasks.length} tasks</span>
                        <span className="font-medium text-foreground">{progress}%</span>
                      </div>
                      <Progress
                        value={progress}
                        indicatorColor={project.color}
                        className="h-1.5"
                      />
                    </div>

                    <StatusBadge status={project.status} />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          aria-label={`More options for ${project.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(project)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeletingProjectId(project.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editingProject}
        onSubmit={handleDialogSubmit}
      />

      <ConfirmDialog
        open={!!deletingProjectId}
        onOpenChange={(open) => !open && setDeletingProjectId(null)}
        title="Delete Project?"
        description="Are you sure you want to delete this project? Associated tasks will be preserved as unassigned tasks."
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
