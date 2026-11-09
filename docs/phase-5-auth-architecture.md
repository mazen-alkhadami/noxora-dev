# NEXORA DevHub — Phase 5: Authentication & Real User Accounts Architecture

## 1. Executive Summary & Goals

Phase 5 transitions NEXORA DevHub from a single-tenant development environment powered by the Demo User identity (`usr_demo_nexora_dev`) to a multi-user, production-ready SaaS platform with secure email/password authentication, session management, and strict multi-tenant data isolation.

### Key Objectives
1. **Multi-User Authentication**: Production-grade authentication using **Auth.js v5 (`next-auth@beta`)** with `@auth/prisma-adapter` and `bcryptjs` password hashing (salt rounds: 12).
2. **Data Preservation**: Absolute preservation of existing Neon PostgreSQL tables, migrations, and demo data. New users receive their own isolated workspaces without cross-tenant leakage.
3. **Zero-Trust Ownership**: Continuous server-side session resolution via `auth()` in `resolveCurrentUser()`. Client-provided `userId` parameters remain rejected or ignored.
4. **Middleware Protection**: Edge/server middleware guarding all protected application routes (`/dashboard`, `/projects`, `/tasks`, `/kanban`, `/calendar`, `/notes`, `/settings`), redirecting unauthenticated traffic to `/login` with return URL handling, and redirecting authenticated users away from `/login` and `/register`.
5. **Anti-Enumeration & Security**: Generic authentication error responses preventing user enumeration, robust Zod validation, rate-limiting-ready structures, and constant-time password comparisons.
6. **OAuth Readiness**: Pre-configured architecture and environment structure ready for Google and GitHub OAuth providers without requiring local secret activation.

---

## 2. Authentication Stack & Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                              │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────┐ │
│  │     /login Page       │  │    /register Page     │  │ Protected   │ │
│  │ (Credentials/OAuth UI)│  │ (Validation & Submit) │  │ App Pages   │ │
│  └───────────┬───────────┘  └───────────┬───────────┘  └──────┬──────┘ │
└──────────────┼──────────────────────────┼─────────────────────┼────────┘
               │                          │                     │
               ▼                          ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             Network Edge                               │
│  src/middleware.ts (Route Protection & Session Verification)            │
│  • Public: /, /login, /register, /api/auth/*                           │
│  • Protected: /dashboard, /projects, /tasks, /kanban, /calendar, etc.  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│       API Route Handler      │        │        Server Actions        │
│  /api/auth/[...nextauth]     │        │  src/actions/*.actions.ts    │
│  • GET / POST handlers       │        │  • resolveCurrentUser()      │
│  • Session token exchange    │        │  • Strict session check      │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │                                       │
               ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Core Authentication (Auth.js)                   │
│  src/lib/auth.ts                                                       │
│  • Strategy: JWT (JSON Web Tokens) with AUTH_SECRET                    │
│  • Provider: Credentials (email + bcryptjs compare)                    │
│  • Providers (Optional): GitHub, Google                                │
│  • PrismaAdapter(prisma)                                               │
│  • Callbacks: jwt (persists user.id), session (exposes session.user.id)│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Neon PostgreSQL Storage                        │
│  • User (id, email, password, name, image, role)                       │
│  • Account (OAuth provider accounts)                                   │
│  • Session (Database sessions if needed)                               │
│  • VerificationToken (Email verification tokens)                       │
│  • UserPreferences (1:1 per user: theme, compactMode, defaultView)     │
│  • Project, Task, Note, Activity (Enforced by @@unique([id, userId]))  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Session Strategy: JWT vs. Database Sessions

Because Auth.js with the **Credentials provider** does not support database sessions out-of-the-box (credentials authentication does not automatically persist session tokens into the database table upon login in standard Auth.js flows), we utilize the **JWT session strategy**:

```typescript
export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role || "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  // ...
};
```

### Benefits for NEXORA DevHub:
1. **Zero Database Query on Auth Check**: Every middleware pass and `auth()` inspection can decode and verify the cryptographically signed JWT without an extra round-trip to Neon, minimizing connection pool usage.
2. **Instant Scalability & Serverless Compatibility**: Works seamlessly with Vercel and Next.js Server Components / Server Actions.
3. **Database Fallback Support**: OAuth accounts (Google/GitHub) still link into the `Account` table via `PrismaAdapter`.

---

## 4. Password Security & Hashing Specification

1. **Algorithm**: `bcryptjs` with a cost factor (salt rounds) of `12`.
2. **Input Validation**:
   - Minimum length: 8 characters.
   - Maximum length: 128 characters (preventing DoS from oversized inputs).
   - Requirement: At least one letter and at least one number.
3. **Comparison**:
   - Asynchronous `bcrypt.compare(providedPassword, storedHash)` ensures constant-time execution against timing attacks.
   - When a user is not found, a dummy bcrypt comparison or identical latency path is executed to prevent user enumeration through response timing differences.

---

## 5. Generic Error Handling & Anti-Enumeration

To prevent malicious actors from determining whether an email exists in the database:
- **Registration**: If an email already exists, return an error message that is informative yet secure: `"Unable to complete registration. If you already have an account, please sign in."`
- **Login**: Both "user not found" and "incorrect password" return the identical error:
  `"Invalid email or password. Please check your credentials and try again."`
- **Password Reset (Future)**: Will always respond with `"If an account exists for this email, a reset link has been dispatched."`

---

## 6. Server Action Protection & `resolveCurrentUser()`

Currently, `resolveCurrentUser()` in `src/lib/auth-context.ts` defaults to the Demo User. In Phase 5:

```typescript
import { auth } from "@/lib/auth";

export async function resolveCurrentUser(): Promise<CurrentUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ActionError(
      "UNAUTHORIZED",
      "You must be signed in to perform this action."
    );
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "unknown@user.com",
    name: session.user.name ?? "User",
    isDemo: session.user.id === "usr_demo_nexora_dev",
  };
}
```

Every existing Server Action already calls `resolveCurrentUser()` and enforces `userId: currentUser.id` in every Prisma query. By updating this single function, **100% of existing Server Actions (Projects, Tasks, Notes, Activity, Preferences, Migration) become instantly secured for real authenticated users**.

---

## 7. Route Protection Matrix

| Route | Access Level | Unauthenticated Action | Authenticated Action |
| :--- | :--- | :--- | :--- |
| `/` (Landing/Home) | Public | Render Landing | Render Landing |
| `/login` | Public Only | Render Login Form | Redirect to `/dashboard` |
| `/register` | Public Only | Render Register Form | Redirect to `/dashboard` |
| `/api/auth/*` | Public / NextAuth | Process Auth API Request | Process Auth API Request |
| `/dashboard` | Protected | Redirect to `/login?callbackUrl=/dashboard` | Render Dashboard |
| `/projects` | Protected | Redirect to `/login?callbackUrl=/projects` | Render Projects |
| `/tasks` | Protected | Redirect to `/login?callbackUrl=/tasks` | Render Tasks |
| `/kanban` | Protected | Redirect to `/login?callbackUrl=/kanban` | Render Kanban |
| `/calendar` | Protected | Redirect to `/login?callbackUrl=/calendar` | Render Calendar |
| `/notes` | Protected | Redirect to `/login?callbackUrl=/notes` | Render Notes |
| `/settings` | Protected | Redirect to `/login?callbackUrl=/settings` | Render Settings |

---

## 8. Data Isolation & New User Provisioning

When a new user signs up:
1. `User` record created with hashed password.
2. `UserPreferences` record provisioned with defaults (`theme: "system"`, `compactMode: false`, `defaultView: "kanban"`).
3. The workspace is created **empty** (no projects or tasks copied from demo user).
4. An initial activity log entry is recorded: `"User account created"`.
5. Existing Demo User data remains untouched in Neon PostgreSQL for regression and reference purposes.
