"use server"

import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from "@/lib/validations/auth.schema"
import { checkDistributedRateLimit } from "@/lib/services/rate-limit.service"
import {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
} from "@/lib/services/email.service"
import { resolveCurrentUser } from "@/lib/auth-context"
import type { ActionResult } from "@/types/actions"

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return "U"
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]
  if (!last) return first.slice(0, 2).toUpperCase()
  const firstChar = first[0] ?? ""
  const lastChar = last[0] ?? ""
  return (firstChar + lastChar).toUpperCase()
}

export interface RegisteredUser {
  id: string
  email: string
  name: string
}

export async function registerUserAction(
  rawInput: RegisterInput
): Promise<ActionResult<RegisteredUser>> {
  try {
    const parsed = registerSchema.safeParse(rawInput)
    if (!parsed.success) {
      const issues: Record<string, string[]> = {}
      for (const err of parsed.error.issues) {
        const path = err.path.join(".")
        if (!issues[path]) issues[path] = []
        issues[path].push(err.message)
      }
      return {
        success: false,
        error: "Validation failed: please review the required fields.",
        issues,
      }
    }

    const { name, email, password } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    // ── RATE LIMITING (Distributed + Multi-Instance) ──
    const rateLimit = await checkDistributedRateLimit(`register:${normalizedEmail}`, 5, 300)
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Too many registration attempts. Please wait ${rateLimit.resetInSeconds} seconds before trying again.`,
      }
    }

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existing) {
      return {
        success: false,
        error: "An account with this email address already exists. Please sign in instead.",
      }
    }

    // Hash password with salt rounds = 12
    const hashedPassword = await bcrypt.hash(password, 12)
    const initials = computeInitials(name)

    // Atomically create user and default preferences
    const createdUser = await prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          initials,
          title: "Full-Stack Developer",
          migrationCompletedAt: new Date(),
          preferences: {
            create: {
              defaultView: "dashboard",
              taskDensity: "comfortable",
              confirmBeforeDelete: true,
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      })
    })

    return {
      success: true,
      data: {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name ?? name,
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed. Please try again."
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Requests a secure password reset link for the given email.
 * Implements anti-enumeration: always returns a success confirmation.
 */
export async function requestPasswordResetAction(
  rawInput: ForgotPasswordInput
): Promise<ActionResult<{ message: string }>> {
  try {
    const parsed = forgotPasswordSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: "Please provide a valid email address.",
      }
    }

    const { email } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    // Rate limit: 3 requests per 15 minutes per email (Distributed)
    const rateLimit = await checkDistributedRateLimit(`pwd_reset_req:${normalizedEmail}`, 3, 15 * 60)
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Too many password reset requests. Please wait ${rateLimit.resetInSeconds} seconds before trying again.`,
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    })

    // If user exists, create secure token and send email
    if (user) {
      // Remove any prior tokens for this email
      await prisma.verificationToken.deleteMany({
        where: { identifier: `reset:${normalizedEmail}` },
      })

      // Generate 32-byte cryptographically secure random token (64 hex characters)
      const token = crypto.randomBytes(32).toString("hex")
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.verificationToken.create({
        data: {
          identifier: `reset:${normalizedEmail}`,
          token,
          expires,
        },
      })

      await sendPasswordResetEmail(normalizedEmail, token)
    }

    // Always return generic confirmation (anti-enumeration)
    return {
      success: true,
      data: {
        message:
          "If an account exists for this email, you will receive password reset instructions shortly.",
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process password reset request."
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Validates reset token and sets the new password.
 * Deletes the token upon success (single-use token enforcement).
 */
export async function resetPasswordAction(
  rawInput: ResetPasswordInput
): Promise<ActionResult<{ message: string }>> {
  try {
    const parsed = resetPasswordSchema.safeParse(rawInput)
    if (!parsed.success) {
      const issues: Record<string, string[]> = {}
      for (const err of parsed.error.issues) {
        const path = err.path.join(".")
        if (!issues[path]) issues[path] = []
        issues[path].push(err.message)
      }
      return {
        success: false,
        error: "Validation failed: please check your inputs.",
        issues,
      }
    }

    const { token, password } = parsed.data

    // Locate token in database
    const record = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!record || !record.identifier.startsWith("reset:")) {
      return {
        success: false,
        error: "Invalid or expired password reset link. Please request a new one.",
      }
    }

    // Check expiration
    if (record.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
      return {
        success: false,
        error: "This password reset link has expired. Please request a new one.",
      }
    }

    const email = record.identifier.replace("reset:", "")
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (!user) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
      return {
        success: false,
        error: "Account not found.",
      }
    }

    const newHashedPassword = await bcrypt.hash(password, 12)

    // Atomically update user password, increment sessionVersion, and destroy the single-use token
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: newHashedPassword,
          sessionVersion: { increment: 1 },
        },
      })

      await tx.verificationToken.delete({
        where: { token },
      })
    })

    return {
      success: true,
      data: {
        message: "Your password has been successfully reset. You can now sign in.",
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset password. Please try again."
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Validates an email verification token and stamps emailVerified.
 */
export async function verifyEmailAction(
  rawInput: VerifyEmailInput
): Promise<ActionResult<{ message: string }>> {
  try {
    const parsed = verifyEmailSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid verification token format.",
      }
    }

    const { token } = parsed.data

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!record || !record.identifier.startsWith("verify:")) {
      return {
        success: false,
        error: "Invalid or expired verification link.",
      }
    }

    if (record.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
      return {
        success: false,
        error: "This verification link has expired. Please request a new one.",
      }
    }

    const email = record.identifier.replace("verify:", "")

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      })

      await tx.verificationToken.delete({
        where: { token },
      })
    })

    return {
      success: true,
      data: {
        message: "Email address successfully verified.",
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Email verification failed."
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Sends a new email verification link to the current authenticated user.
 */
export async function requestEmailVerificationAction(): Promise<
  ActionResult<{ message: string }>
> {
  try {
    const currentUser = await resolveCurrentUser()

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { email: true, emailVerified: true },
    })

    if (!user) {
      return { success: false, error: "User not found." }
    }

    if (user.emailVerified) {
      return { success: true, data: { message: "Email is already verified." } }
    }

    // Rate limit (Distributed)
    const rateLimit = await checkDistributedRateLimit(`email_verify_req:${user.email}`, 3, 10 * 60)
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Please wait ${rateLimit.resetInSeconds} seconds before requesting another verification email.`,
      }
    }

    await prisma.verificationToken.deleteMany({
      where: { identifier: `verify:${user.email}` },
    })

    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: `verify:${user.email}`,
        token,
        expires,
      },
    })

    await sendEmailVerificationEmail(user.email, token)

    return {
      success: true,
      data: {
        message: "Verification email sent. Please check your inbox.",
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to request email verification."
    return {
      success: false,
      error: message,
    }
  }
}
