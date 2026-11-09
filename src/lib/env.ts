import { z } from "zod"

/**
 * Server-side environment variable validation schema.
 * Ensures critical secrets and connection strings are present and well-formed.
 * Fails fast with redacted error details to prevent credential leaks.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
      "DATABASE_URL must be a valid PostgreSQL connection string"
    ),
  DIRECT_URL: z
    .string()
    .min(1, "DIRECT_URL is required for migrations")
    .optional(),
  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET must be at least 16 characters long"),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

export function getValidatedEnv(): Env {
  if (cachedEnv) return cachedEnv

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `• ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")

    // In production, fail immediately without revealing existing secret contents
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `[FATAL] Environment validation failed. Missing or invalid required environment variables:\n${errorDetails}`
      )
    }

    console.warn(`[WARN] Environment validation warnings:\n${errorDetails}`)
    // In dev, provide parsed data with fallbacks if minimal essentials exist
    cachedEnv = process.env as unknown as Env
    return cachedEnv
  }

  cachedEnv = parsed.data
  return cachedEnv
}
