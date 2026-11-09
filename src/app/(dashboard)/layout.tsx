import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { MigrationBanner } from "@/components/layout/migration-banner"
import { DataProvider } from "@/context/data-context"

/**
 * DashboardLayout — the shell layout shared by all dashboard routes.
 * Wraps content with DataProvider for centralized reactive data state.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DataProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* ── Desktop sidebar ── */}
        <div className="hidden lg:flex lg:shrink-0">
          <Sidebar />
        </div>

        {/* ── Main content column ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          <MigrationBanner />
          <main
            className="flex-1 overflow-y-auto"
            id="main-content"
          >
            <div className="mx-auto max-w-screen-xl p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DataProvider>
  )
}
