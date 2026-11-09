"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

/**
 * ThemeProvider wraps next-themes to enable dark/light/system mode switching.
 * Must be a Client Component because it reads/writes localStorage and
 * the `class` attribute on <html>.
 *
 * Placed in the root layout so every page inherits theme context.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
