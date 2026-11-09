/**
 * Hydration-safe localStorage utilities.
 *
 * All reads happen only after mount (inside useEffect) so there is never
 * a mismatch between the server-rendered HTML and the client initial render.
 */

export function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage unavailable — fail silently
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {}
}

/** Generate a short, URL-safe unique ID without external dependencies. */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
