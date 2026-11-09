"use client"

import * as React from "react"
import { Database, RefreshCw, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useData } from "@/context/data-context"

export function MigrationBanner() {
  const { migrationStatus, triggerMigration, dismissMigration } = useData()
  const [isDismissed, setIsDismissed] = React.useState(false)

  if (isDismissed || !migrationStatus.needsMigration) {
    return null
  }

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 text-xs text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all">
      <div className="flex items-center gap-2.5">
        <div className="p-1 rounded bg-primary/20 text-primary shrink-0">
          <Database className="h-4 w-4" />
        </div>
        <div>
          <span className="font-semibold text-foreground">Local Workspace Detected: </span>
          <span className="text-muted-foreground">
            {migrationStatus.isMigrating
              ? migrationStatus.progress || "Synchronizing local data with Neon PostgreSQL..."
              : "You have local workspace data in your browser. Migrate it now to persist across devices in PostgreSQL."}
          </span>
          {migrationStatus.error && (
            <span className="text-destructive font-medium block mt-0.5">
              Error: {migrationStatus.error}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs gap-1.5"
          disabled={migrationStatus.isMigrating}
          onClick={() => triggerMigration()}
        >
          {migrationStatus.isMigrating ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" />
              Migrating...
            </>
          ) : (
            <>
              Sync with Cloud
              <ArrowRight className="h-3 w-3" />
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setIsDismissed(true)
            dismissMigration()
          }}
          aria-label="Dismiss migration prompt"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
