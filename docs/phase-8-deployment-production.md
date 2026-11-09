# NEXORA DevHub — Phase 8: Deployment & Production Setup Guide

## 1. Executive Summary

This document establishes the production deployment architecture and verification results for **NEXORA DevHub**. The application is fully prepared for continuous deployment on **Vercel** with a **Neon Serverless PostgreSQL** backend, **Prisma ORM** migrations, and **Auth.js v5** authentication.

---

## 2. Hosting & Infrastructure Architecture

```
[ Clients / Web Browsers ]
            │  HTTPS (TLS 1.3)
            ▼
[ Vercel Edge Network ]
   ├─ Edge Middleware (src/middleware.ts, 87.3 kB)
   │    └─ Route protection & unauthenticated redirects to /login
   ├─ Static Edge CDN Assets
   │    └─ Prerendered pages, CSS, SVGs, static JS chunks
   └─ Serverless Functions (Node.js runtime)
        ├─ NextAuth API routes (/api/auth/[...nextauth])
        └─ Server Actions (Projects, Tasks, Notes, Settings, Profile)
                 │
                 ├─ [ Neon Serverless PostgreSQL ]
                 │    ├─ DATABASE_URL: Pooled connection (PgBouncer) for runtime queries
                 │    └─ DIRECT_URL: Direct non-pooled connection for 'prisma migrate deploy'
                 │
                 └─ [ Resend API ]
                      └─ Transactional email dispatch (Password reset, Verification)
```

---

## 3. Vercel Configuration & Build Pipeline

### 3.1 Build & Package Scripts
In `package.json`, the deployment scripts are explicitly wired:
- **Build Command**: `prisma generate && next build`
- **Postinstall Command**: `prisma generate`
- **Migration Deployment Command**: `prisma migrate deploy`

### 3.2 Runtime & Framework Compatibility
- **Framework Preset**: Next.js (Automatic Vercel detection)
- **Node.js Engine**: v20.x
- **Prisma Client Generation**: Automatically targets Linux (`rhel-openssl-3.0.x`) within the Vercel container during `prisma generate`.
- **Zero Local File Dependencies**: The build contains no hardcoded local filesystem paths or mock files.

---

## 4. Neon Production Database Setup

### 4.1 Connection Separation: Pooled vs. Direct
Neon provides dual endpoints:
1. **Pooled Connection (`DATABASE_URL`)**:
   - Format: `postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true`
   - Purpose: Handles ephemeral serverless connections efficiently without exhausting PostgreSQL backend connection limits.
2. **Direct Connection (`DIRECT_URL`)**:
   - Format: `postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`
   - Purpose: Used by Prisma during migrations (`prisma migrate deploy`). Transaction poolers (PgBouncer) do not support session advisory locks and table DDL transactions required for safe schema migrations.

### 4.2 Production Migration Procedure
- **Command to Execute**:
  ```bash
  npx prisma migrate deploy
  ```
- **Strict Prohibition**: Never run `prisma migrate dev` or `prisma db push` in production, as they can cause schema drift or data resets.

---

## 5. Environment Variable Checklist

All variable names are specified below with zero secrets or real credentials exposed.

| Variable Name | Classification | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Required (Production)** | Neon pooled connection string for Server Actions and queries. |
| `DIRECT_URL` | **Required (Production)** | Neon direct connection string for Prisma migration deployments. |
| `AUTH_SECRET` | **Required (Production)** | 32-byte cryptographic secret for JWT signing (`openssl rand -base64 32`). |
| `AUTH_URL` | **Required (Production)** | Canonical public URL (e.g. `https://your-domain.vercel.app`). |
| `NEXT_PUBLIC_APP_URL` | **Required (Production)** | Public URL used in email templates and client redirects. |
| `RESEND_API_KEY` | **Required (Optional Email)** | API key for Resend transactional email service. |
| `EMAIL_FROM` | **Required (Optional Email)** | Verified sender email address (e.g. `noreply@yourdomain.com`). |
| `AUTH_GITHUB_ID` / `GITHUB_CLIENT_ID` | **Optional Integration** | GitHub OAuth Client ID. |
| `AUTH_GITHUB_SECRET` / `GITHUB_CLIENT_SECRET` | **Optional Integration** | GitHub OAuth Client Secret. |
| `AUTH_GOOGLE_ID` / `GOOGLE_CLIENT_ID` | **Optional Integration** | Google Cloud OAuth Client ID. |
| `AUTH_GOOGLE_SECRET` / `GOOGLE_CLIENT_SECRET` | **Optional Integration** | Google Cloud OAuth Client Secret. |
| `ALLOW_DEMO_FALLBACK` | **Development-Only** | Strictly disabled (`NODE_ENV === "production"` ignores this). |
| `ENABLE_EMAIL_SIMULATION` | **Development-Only** | Simulated console logging when Resend key is omitted. |

---

## 6. Authentication & Security Hardening

1. **Production `AUTH_SECRET`**:
   - In production, NextAuth requires `AUTH_SECRET`. If omitted, NextAuth fails fast at launch.
2. **Secure HTTPS Cookies**:
   - `useSecureCookies: process.env.NODE_ENV === "production"` enforces `__Secure-` and `__Host-` cookie prefixes under HTTPS.
3. **Open Redirect Defenses**:
   - Callback URLs are strictly validated: protocol-relative URLs (`//evil.com`), backslash bypasses (`\\`), and foreign origins are rejected.
4. **Demo Identity Isolation**:
   - In production, the demo user fallback (`ALLOW_DEMO_FALLBACK`) is completely disabled in `src/lib/auth-context.ts`. All requests require a verified Auth.js session.
5. **Session Revocation Strategy**:
   - Password resets and updates atomically increment `User.sessionVersion` in PostgreSQL, invalidating all pre-existing JWT sessions immediately.
6. **Distributed Rate Limiting**:
   - Powered by PostgreSQL transaction-scoped advisory locks (`pg_advisory_xact_lock(hashtext(${identifier}))`) with bounded exponential backoff retries.

---

## 7. Email Integration (Resend)

- **Provider**: Resend REST API (`https://api.resend.com/emails`).
- **Templates**: HTML + Plaintext responsive transactional templates for:
  - Password Reset: 1-hour expiration, single-use cryptographically secure token.
  - Email Verification: 24-hour expiration token.
- **Graceful Error Handling**: If `RESEND_API_KEY` is not configured, the service logs the event in development or returns `{ success: false }` gracefully in production without throwing unhandled exceptions.

---

## 8. GitHub Repository Readiness

- **`.gitignore` Configuration**:
  - All real environment files (`.env`, `.env.local`, `.env.*.local`) are strictly ignored.
  - `.env.example` is explicitly allowed (`!.env.example`) to provide a clean setup template.
  - `.next/`, `node_modules/`, `*.tsbuildinfo`, and debug logs are ignored.
- **Repository Metadata**:
  - `README.md` completely updated with project architecture, prerequisites, local commands, and Vercel deployment steps.
  - Zero sensitive tokens or credentials committed in git history.

---

## 9. Verification & Quality Assurance Audit

All verification commands executed cleanly with exit code 0:

| Test / Gate | Command | Actual Output / Result | Exit Code |
| :--- | :--- | :--- | :---: |
| **ESLint** | `npm run lint` | 0 errors, 0 warnings | `0` |
| **TypeScript** | `npx tsc --noEmit` | Clean compilation | `0` |
| **Production Build** | `npm run build` | 17/17 routes compiled + 87.3 kB Edge MW | `0` |
| **Prisma Migrations** | `npx prisma migrate status` | Database schema is up to date (2 applied) | `0` |
| **Phase 5 Auth Suite** | `tsx scripts/test-phase5-auth.ts` | 39 / 39 tests passed | `0` |
| **Route Protection Suite** | `tsx scripts/verify-phase5-routes.ts` | 12 / 12 tests passed | `0` |
| **Rate Limit Concurrency** | `tsx scripts/test-rate-limit-concurrency.ts` | 5 / 5 tests passed (20 parallel requests) | `0` |
| **Responsive Audit** | `tsx scripts/test-phase7-responsive.ts` | 70 / 70 tests passed (375px to 1440px) | `0` |

---

## 10. Steps Remaining for Live Deployment

To bring the application live to end-users:

1. **Step 1: Create Vercel Project**:
   - Push repository to private GitHub repository.
   - In Vercel Dashboard, click **Add New > Project** and select the repository.
2. **Step 2: Add Environment Variables in Vercel**:
   - Add `DATABASE_URL` (Neon pooled string).
   - Add `DIRECT_URL` (Neon direct string).
   - Add `AUTH_SECRET` (generate via `openssl rand -base64 32`).
   - Add `AUTH_URL` and `NEXT_PUBLIC_APP_URL` (your Vercel project URL).
   - *(Optional)* Add `RESEND_API_KEY` and `EMAIL_FROM`.
   - *(Optional)* Add OAuth client IDs/secrets if social login is desired.
3. **Step 3: Run Database Migration in Neon**:
   - From deployment terminal or Vercel Build Step: `npx prisma migrate deploy`.
4. **Step 4: Trigger Production Deployment**:
   - Click **Deploy** in Vercel.
