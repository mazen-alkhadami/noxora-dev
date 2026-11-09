import type { LucideIcon } from "lucide-react"

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

// ─── Auth (placeholder — implemented Phase 5) ─────────────────────────────────

export interface User {
  id: string
  name: string | null
  email: string
  image: string | null
}

// ─── Domain enums ─────────────────────────────────────────────────────────────

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED"
export type TaskStatus    = "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED"
export type Priority      = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

// ─── Domain models ────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  color: string
  createdAt: string  // ISO 8601
  updatedAt: string  // ISO 8601
}

export interface Task {
  id: string
  projectId: string | null
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  dueDate: string | null  // ISO 8601
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  projectId: string | null
  title: string
  content: string   // Rich text HTML string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

// ─── Settings & Preferences ───────────────────────────────────────────────────

export interface UserProfile {
  name: string
  email: string
  initials: string
  title: string
}

export interface UserPreferences {
  defaultView: "dashboard" | "kanban" | "tasks" | "calendar"
  taskDensity: "comfortable" | "compact"
  confirmBeforeDelete: boolean
}

// ─── Activity feed ────────────────────────────────────────────────────────────

export type ActivityType =
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "task_deleted"
  | "note_created"
  | "note_updated"
  | "note_deleted"

export interface Activity {
  id: string
  type: ActivityType
  title: string       // human-readable description
  timestamp: string   // ISO 8601
}

// ─── Form shapes (Omit derived fields) ───────────────────────────────────────

export type ProjectFormData = Pick<Project, "name" | "description" | "status" | "color">
export type TaskFormData    = Pick<Task, "title" | "description" | "status" | "priority" | "dueDate" | "projectId">
export type NoteFormData    = Pick<Note, "title" | "content" | "projectId">

// ─── Synchronization state ───────────────────────────────────────────────────

export type SyncState = "SYNCED" | "SYNCING" | "OFFLINE_LOCAL" | "SYNC_FAILED"
