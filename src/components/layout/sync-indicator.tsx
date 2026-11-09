"use client"

import * as React from "react"
import { Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react"
import { useData } from "@/context/data-context"

export function SyncIndicator() {
  const { syncState, lastSyncError, retrySync } = useData()

  if (syncState === "SYNCING") {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
        title="Syncing changes with PostgreSQL database..."
      >
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span className="hidden sm:inline">Syncing...</span>
      </div>
    )
  }

  if (syncState === "OFFLINE_LOCAL") {
    return (
      <button
        onClick={() => retrySync()}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        title="Database unavailable. Changes saved to localStorage only. Click to retry connection."
      >
        <CloudOff className="h-3 w-3" />
        <span className="hidden sm:inline">Offline (Local Only)</span>
      </button>
    )
  }

  if (syncState === "SYNC_FAILED") {
    return (
      <button
        onClick={() => retrySync()}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
        title={lastSyncError ? `Sync failed: ${lastSyncError}. Click to retry.` : "Sync failed. Click to retry."}
      >
        <AlertCircle className="h-3 w-3" />
        <span className="hidden sm:inline">Sync Failed</span>
      </button>
    )
  }

  // Default: SYNCED
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
      title="All changes synchronized with Neon PostgreSQL"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 duration-1000" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <Cloud className="h-3 w-3" />
      <span className="hidden sm:inline">Synced</span>
    </div>
  )
}
