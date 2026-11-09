"use client"

import * as React from "react"
import type { Project, ProjectFormData, ProjectStatus } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const PROJECT_COLORS = [
  { hex: "#6366f1", name: "Indigo" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#ef4444", name: "Red" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#a1a1aa", name: "Zinc" },
]

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  onSubmit: (data: ProjectFormData) => void
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onSubmit,
}: ProjectDialogProps) {
  const isEditing = !!project

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [status, setStatus] = React.useState<ProjectStatus>("ACTIVE")
  const [color, setColor] = React.useState("#6366f1")
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description)
      setStatus(project.status)
      setColor(project.color)
    } else {
      setName("")
      setDescription("")
      setStatus("ACTIVE")
      setColor("#6366f1")
    }
    setError("")
  }, [project, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Project name is required")
      return
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      status,
      color,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Project" : "New Project"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update your project details and status."
                : "Create a new project workspace to organize your tasks."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label
                htmlFor="project-name"
                className="text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Project Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError("")
                }}
                placeholder="e.g. Next-Gen Mobile App"
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="project-desc"
                className="text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Description
              </label>
              <Textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is the primary objective of this project?"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="project-status"
                className="text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Status
              </label>
              <select
                id="project-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Theme Color
              </label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((item) => {
                  const isSelected = color === item.hex
                  return (
                    <button
                      key={item.hex}
                      type="button"
                      onClick={() => setColor(item.hex)}
                      className={cn(
                        "relative flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110",
                        isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      )}
                      style={{ backgroundColor: item.hex }}
                      title={item.name}
                      aria-label={`Select ${item.name} theme color`}
                    >
                      {isSelected && (
                        <Check className="h-4 w-4 text-white drop-shadow-sm" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
