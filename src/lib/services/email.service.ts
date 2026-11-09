/**
 * Production-ready email dispatch service for authentication (password reset, email verification).
 *
 * Supports:
 * - Production: Resend API when RESEND_API_KEY is configured.
 * - Development/Staging: Console delivery simulation without leaking sensitive tokens in production logs.
 */

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export function getAppBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.AUTH_URL) return process.env.AUTH_URL
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string }> {
  const { to, subject, html } = options

  // 1. Check for Resend provider
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "NEXORA DevHub <noreply@nexora.dev>",
          to: [to],
          subject,
          html,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        return { success: true, messageId: data.id }
      } else {
        const errorText = await res.text()
        console.error("[EmailService] Resend API error response:", res.status, errorText)
      }
    } catch (err) {
      console.error("[EmailService] Failed to send email via Resend:", err)
    }
  }

  // 2. Fallback / Development logger (Redacts all sensitive tokens and content)
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_EMAIL_SIMULATION === "true"
  ) {
    console.log("─────────────────────────────────────────────────────────────────")
    console.log(`[EmailService: Simulated Dispatch]`)
    console.log(`  To:      ${to}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Status:  Simulated local dispatch (tokens redacted)`)
    console.log("─────────────────────────────────────────────────────────────────")
    return { success: true, messageId: `sim_${Date.now()}` }
  }

  return { success: false }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<boolean> {
  const baseUrl = getAppBaseUrl()
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`

  const res = await sendEmail({
    to: email,
    subject: "Reset your NEXORA DevHub password",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a;">Reset Your Password</h2>
        <p>We received a request to reset your password for your NEXORA DevHub account.</p>
        <p>Click the link below to set a new password. This link is valid for 1 hour and can only be used once.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  })

  return res.success
}

export async function sendEmailVerificationEmail(
  email: string,
  token: string
): Promise<boolean> {
  const baseUrl = getAppBaseUrl()
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`

  const res = await sendEmail({
    to: email,
    subject: "Verify your email for NEXORA DevHub",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a;">Verify Your Email Address</h2>
        <p>Thank you for signing up for NEXORA DevHub. Please confirm your email address by clicking the link below:</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">This link will expire in 24 hours.</p>
      </div>
    `,
  })

  return res.success
}
