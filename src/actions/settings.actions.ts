"use server"

import { prisma } from "@/lib/prisma"
import { resolveCurrentUser } from "@/lib/auth-context"
import {
  updateProfileSchema,
  updatePreferencesSchema,
  type UpdateProfileInput,
  type UpdatePreferencesInput,
} from "@/lib/validations/settings.schema"
import type { ActionResult } from "@/types/actions"
import type { UserProfile, UserPreferences } from "@/types"

export interface UserSettingsResponse {
  profile: UserProfile
  preferences: UserPreferences
}

export async function getSettingsAction(): Promise<ActionResult<UserSettingsResponse>> {
  try {
    const user = await resolveCurrentUser()
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { preferences: true },
    })

    if (!dbUser) {
      return { success: false, error: "User not found" }
    }

    const profile: UserProfile = {
      name: dbUser.name || "Alex Rivera",
      email: dbUser.email,
      initials: dbUser.initials || "AR",
      title: dbUser.title || "Full-Stack Developer",
    }

    const preferences: UserPreferences = {
      defaultView: (dbUser.preferences?.defaultView as UserPreferences["defaultView"]) || "dashboard",
      taskDensity: (dbUser.preferences?.taskDensity as UserPreferences["taskDensity"]) || "comfortable",
      confirmBeforeDelete: dbUser.preferences?.confirmBeforeDelete ?? true,
    }

    return {
      success: true,
      data: { profile, preferences },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings"
    return { success: false, error: message }
  }
}

export async function updateProfileAction(
  rawInput: UpdateProfileInput
): Promise<ActionResult<UserProfile>> {
  try {
    const user = await resolveCurrentUser()
    const parsed = updateProfileSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
    })

    const profile: UserProfile = {
      name: updated.name || "Alex Rivera",
      email: updated.email,
      initials: updated.initials || "AR",
      title: updated.title || "Full-Stack Developer",
    }

    return {
      success: true,
      data: profile,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile"
    return { success: false, error: message }
  }
}

export async function updatePreferencesAction(
  rawInput: UpdatePreferencesInput
): Promise<ActionResult<UserPreferences>> {
  try {
    const user = await resolveCurrentUser()
    const parsed = updatePreferencesSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      }
    }

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: parsed.data,
      create: {
        userId: user.id,
        defaultView: parsed.data.defaultView || "dashboard",
        taskDensity: parsed.data.taskDensity || "comfortable",
        confirmBeforeDelete: parsed.data.confirmBeforeDelete ?? true,
      },
    })

    const result: UserPreferences = {
      defaultView: preferences.defaultView as UserPreferences["defaultView"],
      taskDensity: preferences.taskDensity as UserPreferences["taskDensity"],
      confirmBeforeDelete: preferences.confirmBeforeDelete,
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update preferences"
    return { success: false, error: message }
  }
}
