import type { Metadata } from "next"
import { ThemeProvider } from "@/components/providers/theme-provider"
import "./globals.css"

/**
 * Fonts are loaded as CSS variables via globals.css @import / system stack.
 * next/font/google requires network at build time — we use a local system-safe
 * fallback here and will configure self-hosted fonts in the deployment phase.
 */

export const metadata: Metadata = {
  title: {
    default: "NEXORA DevHub",
    template: "%s | NEXORA DevHub",
  },
  description:
    "A modern project and task management platform for developers, freelancers, and independent creators.",
  keywords: ["project management", "task management", "kanban", "developer tools"],
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
