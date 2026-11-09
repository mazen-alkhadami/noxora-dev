# NEXORA DevHub — Production Deployment Guide

> **Production Application:** [https://noxora-dev.vercel.app](https://noxora-dev.vercel.app)  
> **Source Repository:** [https://github.com/mazen-alkhadami/noxora-dev](https://github.com/mazen-alkhadami/noxora-dev)  
> **Target Hosting Platform:** Vercel (Edge & Node.js 20 Serverless)  
> **Production Database:** Neon Serverless PostgreSQL

---

## 1. Architecture Overview

NEXORA DevHub is engineered to run seamlessly on a modern serverless stack:
- **Vercel:** Hosts the Next.js 15 App Router application, handling Edge Middleware, server-rendered routes, static assets, and Server Actions.
- **Neon Serverless PostgreSQL:** Provides scalable, serverless PostgreSQL storage with connection pooling via PgBouncer.

```mermaid
flowchart LR
    VercelBuild["Vercel Build Pipeline"] -->|"1. prisma migrate deploy"| NeonDirect["Neon Direct Endpoint (DIRECT_URL)"]
    VercelBuild -->|"2. prisma generate"| ClientGen["Generate Prisma Client"]
    VercelBuild -->|"3. next build"| OutputBundle["Optimized Output Chunks"]
    OutputBundle --> VercelProd["Vercel Global Edge"]
    VercelProd -->|"Runtime Server Actions"| NeonPooler["Neon PgBouncer Pool (DATABASE_URL)"]
```

---

## 2. Dual Connection String Strategy

PostgreSQL connection pooling is critical for serverless environments, but migration tools require direct, unpooled access:

| Variable | Purpose | Connection Type | Neon Endpoint Pattern |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Application runtime, Server Actions, queries | **Pooled (PgBouncer)** | `postgres://user:pass@ep-xyz-pooler.aws.neon.tech/neondb?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Prisma migrations (`prisma migrate deploy`) | **Direct (Non-pooled)** | `postgres://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require` |

> [!IMPORTANT]
> Both `DATABASE_URL` and `DIRECT_URL` must point to the **same** Neon database and the **same** Neon branch (e.g. `production` or `main`). Never mix pooled strings from one branch with direct strings from another.

---

## 3. Automated Migration Build Gate

To prevent database desynchronization in production, the project's build command in `package.json` is configured as:

```json
"build": "prisma migrate deploy && prisma generate && next build"
```

During each Vercel deployment:
1. `prisma migrate deploy` runs first using `DIRECT_URL`. It connects to Neon and applies any unapplied migration files. If a migration fails, the build halts immediately, preventing an un-migrated build from serving traffic.
2. `prisma generate` generates the typed Prisma Client.
3. `next build` compiles and optimizes the Next.js App Router application.

---

## 4. Environment Variables Configuration

Configure the following environment variables in the Vercel Dashboard under **Project Settings > Environment Variables**:

### Required Variables

```env
# ── Neon PostgreSQL Database Connection (Pooled) ──
DATABASE_URL="postgres://[username]:[password]@[neon-host]-pooler.[region].aws.neon.tech/[dbname]?sslmode=require&pgbouncer=true"

# ── Neon PostgreSQL Direct Connection for Migrations (Unpooled) ──
DIRECT_URL="postgres://[username]:[password]@[neon-host].[region].aws.neon.tech/[dbname]?sslmode=require"

# ── Auth.js v5 Production Security Secret (Min 32 random bytes) ──
AUTH_SECRET="[generate-with-openssl-rand-base64-32]"

# ── Canonical Application URL ──
AUTH_URL="https://noxora-dev.vercel.app"
NEXT_PUBLIC_APP_URL="https://noxora-dev.vercel.app"

# ── Node Environment ──
NODE_ENV="production"
```

### Optional Integration Variables

```env
# ── Transactional Email (Resend) ──
RESEND_API_KEY="re_[your-resend-api-key]"
EMAIL_FROM="NEXORA DevHub <noreply@yourdomain.com>"

# ── GitHub OAuth ──
AUTH_GITHUB_ID="[your-github-client-id]"
AUTH_GITHUB_SECRET="[your-github-client-secret]"

# ── Google OAuth ──
AUTH_GOOGLE_ID="[your-google-client-id]"
AUTH_GOOGLE_SECRET="[your-google-client-secret]"
```

---

## 5. Step-by-Step Deployment Runbook

### Step 1: Provision Neon PostgreSQL
1. Create a Neon account at [neon.tech](https://neon.tech).
2. Create a new project named `nexora-devhub`.
3. In the Neon Dashboard, copy:
   - The **Connection Details** with "Pooled connection" checked (use for `DATABASE_URL`).
   - The **Connection Details** with "Pooled connection" unchecked (use for `DIRECT_URL`).

### Step 2: Configure Vercel Project
1. Import the GitHub repository `https://github.com/mazen-alkhadami/noxora-dev` into Vercel.
2. Select **Next.js** framework preset.
3. In **Environment Variables**, enter all required variables from Section 4.
4. Leave the Build Command as the default (`npm run build`) which executes `prisma migrate deploy && prisma generate && next build`.

### Step 3: Trigger Initial Deployment
1. Click **Deploy**.
2. Inspect the build logs to verify:
   ```
   > prisma migrate deploy && prisma generate && next build
   2 migrations found in prisma/migrations
   No pending migrations to apply.
   ✔ Generated Prisma Client
   Creating an optimized production build ...
   ✓ Compiled successfully
   ```

---

## 6. Verification & Health Check Runbook

Following deployment, execute the following operational checks:

1. **Root Redirect Health:**
   ```bash
   curl -I https://noxora-dev.vercel.app/
   # Expected: HTTP 307 Temporary Redirect to /login
   ```

2. **Login Route Availability:**
   ```bash
   curl -I https://noxora-dev.vercel.app/login
   # Expected: HTTP 200 OK
   ```

3. **Database Migration Verification:**
   ```bash
   npx prisma migrate status
   # Expected: "Database schema is up to date! 2 migrations found in prisma/migrations"
   ```

4. **Edge Route Protection:**
   ```bash
   curl -I https://noxora-dev.vercel.app/dashboard
   # Expected: HTTP 302 Redirect to /login?callbackUrl=%2Fdashboard
   ```

---

## 7. Disaster Recovery & Rollback Procedures

### Neon Database Branching for Zero-Downtime Rollbacks
1. Neon supports instant copy-on-write database branches.
2. Before major schema migrations, create a backup snapshot branch in the Neon Console:
   ```bash
   # Via Neon CLI:
   neon branches create --name pre-migration-backup
   ```
3. If an emergency rollback is required:
   - Point `DATABASE_URL` and `DIRECT_URL` in Vercel to the backup branch connection string.
   - Redeploy the previous commit on Vercel.
