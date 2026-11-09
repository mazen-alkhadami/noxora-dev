"use client"

import { useState, useEffect } from "react"

const SIDEBAR_STORAGE_KEY = "nexora:sidebar:collapsed"

export function useSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Prevents hydration mismatch: we only read localStorage after mount
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (stored !== null) {
        setIsCollapsed(JSON.parse(stored) as boolean)
      }
    } catch {
      // localStorage unavailable (SSR safety guard)
    }
  }, [])

  const toggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // localStorage unavailable
      }
      return next
    })
  }

  const collapse = () => {
    setIsCollapsed(true)
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, "true")
    } catch {}
  }

  const expand = () => {
    setIsCollapsed(false)
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, "false")
    } catch {}
  }

  return { isCollapsed, toggle, collapse, expand, mounted }
}
