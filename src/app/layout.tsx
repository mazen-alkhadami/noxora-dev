import type { Metadata } from "next"
import { ThemeProvider } from "@/components/providers/theme-provider"
import "./globals.css"

/**
 * Fonts are loaded as CSS variables via globals.css @import / system stack.
 * next/font/google requires network at build time — we use a local system-safe
 * fallback here and will configure self-hosted fonts in the deployment phase.
 */

export const metadata: Metadata = {
  metadataBase: new URL("https://noxora-dev.vercel.app"),
  title: {
    default: "NEXORA DevHub — Developer Project & Task Management SaaS",
    template: "%s | NEXORA DevHub",
  },
  description:
    "Production-grade developer hub and SaaS workspace for managing multi-tenant projects, sprint tasks, interactive Kanban boards, calendars, and technical notes.",
  keywords: [
    "developer tools",
    "project management",
    "task management",
    "kanban board",
    "tiptap rich text",
    "next.js 15",
    "react 19",
    "tailwind css",
    "prisma orm",
    "neon postgresql",
    "auth.js v5",
    "saas platform",
  ],
  authors: [{ name: "Mazen Al-Khadami", url: "https://github.com/mazen-alkhadami" }],
  creator: "Mazen Al-Khadami",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://noxora-dev.vercel.app",
    siteName: "NEXORA DevHub",
    title: "NEXORA DevHub — Developer Project & Task Management SaaS",
    description:
      "Production-grade developer workspace featuring multi-tenant project workspaces, drag-and-drop Kanban, rich-text technical notes, and distributed rate-limited authentication.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXORA DevHub — Developer Project & Task Management SaaS",
    description:
      "Production-grade developer workspace featuring multi-tenant project workspaces, drag-and-drop Kanban, rich-text technical notes, and distributed rate-limited authentication.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
