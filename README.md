# NEXORA DevHub

> Production-Grade Project & Task Management Platform for Engineering Teams.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, **Prisma ORM**, **Neon PostgreSQL**, and **Auth.js v5**.

---

## Features

- **Multi-Tenant Workspace Isolation**: Strict tenant isolation across all projects, tasks, notes, and activity feeds.
- **Interactive Kanban Board**: Drag-and-drop workflow stages powered by `@dnd-kit` with optimistic updates and touch momentum scrolling.
- **Milestone & Schedule Calendar**: Integrated monthly calendar with date-driven scheduling and overdue indicators.
- **Technical Notes with TipTap**: Rich text architecture documentation and sprint specs with code splitting.
- **Production-Grade Authentication**: NextAuth v5 (credentials + optional OAuth) with bcrypt hashing, atomic session revocation, and secure HTTPS cookie handling.
- **Distributed Advisory Rate Limiting**: PostgreSQL-backed atomic advisory locks (`pg_advisory_xact_lock`) with bounded retries defending against brute-force attacks.
- **Responsive & Accessible**: Fully optimized for mobile (375px, 390px), tablet (768px), and desktop (1024px, 1440px) with WCAG 2.1 Level A & AA standards.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 15.5 (App Router, Server Actions, Edge Middleware) |
| **Language** | TypeScript (Strict mode) |
| **Styling** | Tailwind CSS v4, Lucide Icons |
| **Database** | Neon Serverless PostgreSQL |
| **ORM** | Prisma v6 (with connection pooling & direct migration URL) |
| **Authentication** | Auth.js v5 (NextAuth) + `@auth/prisma-adapter` |
| **Rich Editor** | TipTap (`@tiptap/react`, `@tiptap/starter-kit`) |
| **Hosting** | Vercel |

---

## Getting Started

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database (Neon Serverless PostgreSQL recommended)

### 2. Environment Setup
Copy the environment template:
```bash
cp .env.example .env.local
```
Fill in your database connection strings (`DATABASE_URL`, `DIRECT_URL`) and generate a secure auth secret:
```bash
# On Linux / macOS / Git Bash:
openssl rand -base64 32
```

### 3. Install Dependencies & Generate Prisma Client
```bash
npm install
```

### 4. Apply Database Migrations
```bash
npx prisma migrate deploy
```

*(Optional) Seed the database with demo projects and tasks:*
```bash
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Deployment on Vercel

### 1. Database Setup (Neon)
1. In your Neon console, obtain the **Pooled connection string** (for `DATABASE_URL`) and **Direct connection string** (for `DIRECT_URL`).
2. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```

### 2. Configure Vercel Project
1. Import the repository into Vercel.
2. In **Project Settings > Environment Variables**, add:
   - `DATABASE_URL`: Neon pooled connection string (`?sslmode=require&pgbouncer=true`)
   - `DIRECT_URL`: Neon direct connection string (`?sslmode=require`)
   - `AUTH_SECRET`: Random 32-byte secret (`openssl rand -base64 32`)
   - `AUTH_URL`: Canonical production URL (`https://your-domain.vercel.app`)
   - `NEXT_PUBLIC_APP_URL`: Canonical production URL (`https://your-domain.vercel.app`)
   - *(Optional)* `RESEND_API_KEY` & `EMAIL_FROM`: For password resets and transactional email.
   - *(Optional)* `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: For OAuth sign-in.
3. Deploy! Vercel runs `npm run build` which automatically executes `prisma generate && next build`.

---

## Verification & Quality Assurance

```bash
# Run ESLint
npm run lint

# Run TypeScript Typecheck
npx tsc --noEmit

# Run Next.js Production Build
npm run build

# Check Prisma Migration Status
npx prisma migrate status
```
