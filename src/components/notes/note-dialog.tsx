"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { Note, NoteFormData, Project } from "@/types"
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
import { Skeleton } from "@/components/ui/skeleton"

const RichEditor = dynamic(
  () => import("./rich-editor").then((mod) => mod.RichEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full rounded-md" />,
  }
)

interface NoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: Note | null
  projects: Project[]
  onSubmit: (data: NoteFormData) => void
}

export function NoteDialog({
  open,
  onOpenChange,
  note,
  projects,
  onSubmit,
}: NoteDialogProps) {
  const isEditing = !!note

  const [title, setTitle] = React.useState("")
  const [projectId, setProjectId] = React.useState<string>("")
  const [content, setContent] = React.useState("")
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (note) {
      setTitle(note.title)
      setProjectId(note.projectId || "")
      setContent(note.content)
    } else {
      setTitle("")
      setProjectId("")
      setContent("")
    }
    setError("")
  }, [note, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError("Note title is required")
      return
    }

    onSubmit({
      title: title.trim(),
      projectId: projectId || null,
      content,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Note" : "New Note"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update your rich-text note and project association."
                : "Capture architecture thoughts, meeting minutes, or technical documentation."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label
                htmlFor="note-title"
                className="text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Note Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (error) setError("")
                }}
                placeholder="e.g. Service Migration Plan"
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="note-project"
                className="text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Associated Project
              </label>
              <select
                id="note-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No Project (General)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Note Content
              </label>
              <RichEditor
                content={content}
                onChange={setContent}
              />
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
              {isEditing ? "Save Changes" : "Create Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
