import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) {
        // Prevent protocol-relative URLs like "//attacker.com" or backslash attacks
        if (url.startsWith("//") || url.includes("\\")) return baseUrl
        return `${baseUrl}${url}`
      }
      // Allows callback URLs on the same origin
      try {
        if (new URL(url).origin === baseUrl) {
          return url
        }
      } catch {
        // Invalid URL fallback
      }
      return baseUrl
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      const isAuthPage =
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/verify-email")

      const isProtectedPage =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/projects") ||
        pathname.startsWith("/tasks") ||
        pathname.startsWith("/kanban") ||
        pathname.startsWith("/calendar") ||
        pathname.startsWith("/notes") ||
        pathname.startsWith("/settings")

      if (isProtectedPage) {
        if (isLoggedIn) return true
        const loginUrl = new URL("/login", nextUrl)
        loginUrl.searchParams.set("callbackUrl", pathname)
        return Response.redirect(loginUrl)
      }

      if (isAuthPage && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        const sessionVersion = (user as unknown as { sessionVersion?: number })?.sessionVersion
        if (typeof sessionVersion === "number") {
          token.sessionVersion = sessionVersion
        }
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        if (typeof token.sessionVersion === "number") {
          (session.user as unknown as { sessionVersion?: number }).sessionVersion = token.sessionVersion as number
        }
      }
      return session
    },
  },
  providers: [], // Configured with credentials in auth.ts
}
