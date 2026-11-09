"use client"

import * as React from "react"
import { useData } from "@/context/data-context"
import type { Note, NoteFormData } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { NoteDialog } from "@/components/notes/note-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Search,
  FileText,
  MoreVertical,
  Edit2,
  Trash2,
  Calendar,
  LayoutGrid,
  List as ListIcon,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function NotesPage() {
  const { notes, projects, isLoaded, addNote, updateNote, deleteNote } = useData()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [projectFilter, setProjectFilter] = React.useState<string>("ALL")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingNote, setEditingNote] = React.useState<Note | null>(null)
  const [deletingNoteId, setDeletingNoteId] = React.useState<string | null>(null)

  // Filter notes by search query (title or content) and project
  const filteredNotes = React.useMemo(() => {
    return notes.filter((note) => {
      const query = searchQuery.toLowerCase()
      // Strip HTML tags for clean text content search
      const textContent = note.content.replace(/<[^>]+>/g, " ").toLowerCase()
      const matchesSearch =
        note.title.toLowerCase().includes(query) || textContent.includes(query)

      const matchesProject =
        projectFilter === "ALL"
          ? true
          : projectFilter === "UNASSIGNED"
          ? note.projectId === null
          : note.projectId === projectFilter

      return matchesSearch && matchesProject
    })
  }, [notes, searchQuery, projectFilter])

  const handleCreate = () => {
    setEditingNote(null)
    setDialogOpen(true)
  }

  const handleEdit = (note: Note) => {
    setEditingNote(note)
    setDialogOpen(true)
  }

  const handleDialogSubmit = (data: NoteFormData) => {
    if (editingNote) {
      updateNote(editingNote.id, data)
    } else {
      addNote(data)
    }
  }

  const handleDeleteConfirm = () => {
    if (deletingNoteId) {
      deleteNote(deletingNoteId)
      setDeletingNoteId(null)
    }
  }

  // Helper to extract a clean text preview from HTML content
  const getExcerpt = (html: string, maxLength = 140) => {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    if (!text) return "No content"
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
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
            Notes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Document system architecture, sprint thoughts, and technical specifications.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* ── Filter Controls & View Toggle ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search note titles & text..."
              className="pl-9"
            />
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filter notes by project"
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All Projects</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {(searchQuery || projectFilter !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setProjectFilter("ALL")
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              >
                Reset
              </Button>
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

      {/* ── Notes Content ── */}
      {filteredNotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={searchQuery ? "No matching notes" : "No notes captured yet"}
          description={
            searchQuery
              ? `No notes matched your search query or active filter.`
              : "Capture technical specifications, sprint ideas, and architecture documentation."
          }
          action={
            <Button onClick={handleCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Capture First Note
            </Button>
          }
        />
      ) : viewMode === "grid" ? (
        /* Grid Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotes.map((note) => {
            const proj = projects.find((p) => p.id === note.projectId)

            return (
              <Card
                key={note.id}
                onClick={() => handleEdit(note)}
                className="group flex flex-col justify-between cursor-pointer rounded-2xl hover:border-border/80 hover:shadow-sm transition-all"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-foreground text-base truncate group-hover:text-primary transition-colors">
                      {note.title}
                    </h3>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 -mr-2 -mt-1"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={`More options for ${note.title}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(note)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeletingNoteId(note.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-3 mt-2 leading-relaxed">
                    {getExcerpt(note.content)}
                  </p>
                </CardHeader>

                <CardContent className="p-5 pt-0">
                  <div className="flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                    {proj ? (
                      <span className="flex items-center gap-1.5 font-medium text-foreground truncate max-w-[150px]">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span className="truncate">{proj.name}</span>
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/70">General</span>
                    )}

                    <span className="flex items-center gap-1 shrink-0">
                      <Calendar className="h-3 w-3" />
                      {new Date(note.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* List Layout */
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm divide-y divide-border">
          {filteredNotes.map((note) => {
            const proj = projects.find((p) => p.id === note.projectId)

            return (
              <div
                key={note.id}
                onClick={() => handleEdit(note)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {note.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1 pl-6">
                    {getExcerpt(note.content, 180)}
                  </p>
                </div>

                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-6 sm:pl-0"
                >
                  {proj ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: proj.color }}
                      />
                      {proj.name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">General</span>
                  )}

                  <span className="text-xs text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        aria-label={`More options for ${note.title}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(note)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeletingNoteId(note.id)}
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
      )}

      {/* Note Dialog Modal */}
      <NoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        note={editingNote}
        projects={projects}
        onSubmit={handleDialogSubmit}
      />

      {/* Confirm Deletion */}
      <ConfirmDialog
        open={!!deletingNoteId}
        onOpenChange={(open) => !open && setDeletingNoteId(null)}
        title="Delete Note?"
        description="Are you sure you want to delete this note? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
