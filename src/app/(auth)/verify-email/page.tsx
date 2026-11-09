"use client"

import React, { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2, AlertCircle, CheckCircle2, Zap } from "lucide-react"
import { verifyEmailAction } from "@/actions/auth.actions"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setErrorMessage("No verification token was provided.")
      setIsLoading(false)
      return
    }

    let isMounted = true

    async function executeVerification() {
      try {
        const res = await verifyEmailAction({ token })
        if (!isMounted) return

        if (!res.success) {
          setErrorMessage(res.error)
          setIsLoading(false)
          return
        }

        setSuccessMessage(res.data.message)
        setIsLoading(false)
      } catch {
        if (!isMounted) return
        setErrorMessage("An unexpected error occurred during email verification.")
        setIsLoading(false)
      }
    }

    executeVerification()

    return () => {
      isMounted = false
    }
  }, [token])

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Zap className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            NEXORA
          </span>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Email Verification
        </h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
        {isLoading && (
          <div className="py-8 space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Verifying your email address...
            </p>
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              Verification Failed
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {errorMessage}
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        )}

        {!isLoading && successMessage && (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              Email Verified
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {successMessage}
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Proceed to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
