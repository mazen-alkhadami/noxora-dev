# NEXORA DevHub — Phase 4: Backend & Database Architecture

> **Status:** Milestone 1 — Backend Architecture & Database Planning (Final Approved Specification)  
> **Workspace:** `c:\Users\DESKTOP\Desktop\nox\nexora-devhub`  
> **Phase Target:** Transition from client-only `localStorage` to a full-stack architecture powered by PostgreSQL (Neon), Prisma ORM, Next.js Server Actions, and Zod validation, while preserving 100% of the existing frontend UI.

---

## 1. Executive Summary & Design Principles

The frontend of NEXORA DevHub has been successfully built and verified across Dashboard, Projects, Tasks, Kanban Board, Calendar, Notes, and Settings. In Phase 4, we introduce the persistence and business logic layer without breaking any frontend user experiences.

### Core Architecture Principles:
1. **Zero UI Disruption:** The existing UI pages consume data through the reactive `DataContext` (`useData()`). `DataContext` acts as the single adapter dispatching mutations to Server Actions with optimistic UI updates. All page components remain 100% untouched.
2. **Strict Multi-Tenant Isolation:** Every record in PostgreSQL strictly belongs to a verified `userId`. Server Actions enforce ownership on every read and mutation at the database engine level via compound unique constraints (`@@unique([id, userId])`); client-supplied user identifiers are never trusted.
3. **Resilient Dual-Tier Storage & Non-Destructive Migration:** Local data is never deleted. When the database is available, an idempotent, batched migration safely transfers data to PostgreSQL while maintaining a local backup snapshot. If PostgreSQL is temporarily unreachable, the application gracefully operates in an explicit `OFFLINE_LOCAL` state without false "saved" indications.
4. **End-to-End Type Safety & Date-Only Integrity:** Domain models in `src/types/index.ts` are validated at runtime using Zod schemas (`src/lib/validations/*`) and mapped directly to Prisma entities. Task due dates use calendar date-only semantics (`@db.Date` / `YYYY-MM-DD`), preventing timezone shifts across international locales.
5. **Phase 5 Seamless Handover:** Models for Auth.js (`Account`, `Session`, `VerificationToken`) and an authentication resolver abstraction (`resolveCurrentUser()`) are established now so that adding authentication in Phase 5 requires zero schema migrations and zero changes to Server Actions.

---

## 2. Technology Stack & Compatibility Evaluation

| Layer | Selected Tool | Version | Compatibility & Architectural Rationale |
|---|---|---|---|
| **Database** | **PostgreSQL (Neon)** | 16.x (Serverless) | Neon provides instant branching, auto-suspend, and native connection pooling (PgBouncer), making it optimal for serverless Next.js deployments on Vercel without connection exhaustion. |
| **ORM** | **Prisma ORM** | `^6.x` | Declarative schema modeling, automatic TypeScript client generation, type-safe transactions, and native Next.js Server Component/Action compatibility. |
| **Mutation Layer** | **Next.js Server Actions** | Native (Next.js 15) | Direct asynchronous RPC functions executing on the server. Eliminates REST API boilerplate, provides CSRF protection out of the box, and supports React optimistic state reconciliation. |
| **Validation** | **Zod** | `^3.24` | Runtime schema validation and sanitization for all Server Action payloads with automatic compile-time TypeScript type inference. |
| **Connection Pooling** | **Neon Connection Pooler** | PgBouncer Native | Enables high-concurrency serverless query execution via `DATABASE_URL` (`?pgbouncer=true`), while `DIRECT_URL` handles Prisma schema migrations. |

---

## 3. Database Schema Specification (`prisma/schema.prisma`)

### 3.1 Entity Relationship Diagram

```
┌────────────────────────┐          1:N           ┌────────────────────────┐          1:N           ┌────────────────────────┐
│          User          ├───────────────────────►│        Project         ├───────────────────────►│          Task          │
│  (id, email, name...)  │                        │(id, userId, name, col) │                        │(id, userId, status...) │
└───────────┬────────────┘                        └───────────┬────────────┘                        └────────────────────────┘
            │                                                 │
            │ 1:1                                             │ 1:N
            ▼                                                 ▼
┌────────────────────────┐                        ┌────────────────────────┐
│    UserPreferences     │                        │          Note          │
│ (userId, defaultView)  │                        │ (id, userId, content)  │
└────────────────────────┘                        └────────────────────────┘
            │
            │ 1:N
            ▼
┌────────────────────────┐
│        Activity        │
│(userId, type, metadata)│
└────────────────────────┘
            │
            │ 1:N
            ▼
┌────────────────────────┐
│      MigrationLog      │
│ (userId, stage, status)│
└────────────────────────┘
```

### 3.2 Complete Prisma Schema

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ─── Enums ───────────────────────────────────────────────────────────────────

enum ProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  ARCHIVED
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  REVIEW
  COMPLETED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum ActivityType {
  project_created
  project_updated
  project_deleted
  task_created
  task_updated
  task_completed
  task_deleted
  note_created
  note_updated
  note_deleted
}

// ─── Models ──────────────────────────────────────────────────────────────────

model User {
  id                   String           @id @default(cuid())
  name                 String?
  email                String           @unique
  emailVerified        DateTime?
  image                String?
  password             String?          // Nullable for OAuth support (Phase 5)
  title                String?          @default("Full-Stack Developer")
  initials             String?          @default("AR")
  migrationCompletedAt DateTime?       // Stamped when all migration batches succeed
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  // Domain Relations
  projects             Project[]
  tasks                Task[]
  notes                Note[]
  activities           Activity[]
  preferences          UserPreferences?
  migrationLogs        MigrationLog[]

  // Auth.js (NextAuth) pre-allocated models for Phase 5
  accounts             Account[]
  sessions             Session[]

  @@index([email])
}

model UserPreferences {
  id                  String   @id @default(cuid())
  userId              String   @unique
  defaultView         String   @default("dashboard") // "dashboard" | "kanban" | "tasks" | "calendar"
  taskDensity         String   @default("comfortable") // "comfortable" | "compact"
  confirmBeforeDelete Boolean  @default(true)
  updatedAt           DateTime @updatedAt

  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Project {
  id          String        @id @default(cuid())
  userId      String
  name        String
  description String?       @db.Text
  status      ProjectStatus @default(ACTIVE)
  color       String        @default("#6366f1")
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks       Task[]
  notes       Note[]

  // Compound unique constraint guarantees atomic, tenant-safe updates & lookups
  @@unique([id, userId])
  @@index([userId])
  @@index([userId, status])
  @@index([userId, createdAt(sort: Desc)])
}

model Task {
  id          String     @id @default(cuid())
  userId      String
  projectId   String?
  title       String
  description String?    @db.Text
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  dueDate     DateTime?  @db.Date // Strict calendar date (YYYY-MM-DD), avoiding timezone shifting
  order       Float      @default(0.0) // Midpoint drag-and-drop reordering with O(1) single-row writes
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  project     Project?   @relation(fields: [projectId], references: [id], onDelete: SetNull)

  // Compound unique constraint guarantees atomic, tenant-safe updates & lookups
  @@unique([id, userId])
  @@index([userId])
  @@index([userId, status])
  @@index([userId, projectId])
  @@index([userId, dueDate])
  @@index([userId, status, order])
}

model Note {
  id        String   @id @default(cuid())
  userId    String
  projectId String?
  title     String
  content   String   @db.Text // Rich-text HTML content from Tiptap editor
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  // Compound unique constraint guarantees atomic, tenant-safe updates & lookups
  @@unique([id, userId])
  @@index([userId])
  @@index([userId, projectId])
  @@index([userId, createdAt(sort: Desc)])
}

model Activity {
  id        String       @id @default(cuid())
  userId    String
  type      ActivityType
  title     String       // Human-readable summary
  metadata  Json?        // Structured metadata: { entityId, previousStatus, newStatus, entityTitle }
  timestamp DateTime     @default(now())

  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, timestamp(sort: Desc)])
}

model MigrationLog {
  id              String   @id @default(cuid())
  userId          String
  clientBackupKey String
  stage           String   // "PREFERENCES" | "PROJECTS" | "TASKS" | "NOTES" | "COMPLETED"
  batchIndex      Int      @default(0)
  totalBatches    Int      @default(1)
  projectsCount   Int      @default(0)
  tasksCount      Int      @default(0)
  notesCount      Int      @default(0)
  status          String   // "IN_PROGRESS" | "COMPLETED" | "FAILED"
  error           String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// ─── Auth.js Required Tables (Pre-allocated for Phase 5) ─────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

---

## 4. Safe Data Ownership & Authorization Strategy

### 4.1 Strict Multi-Tenant Isolation
In a multi-user application, records belonging to different users must never be visible, updated, or mixed.

1. **Server-Side Identity Authority:**
   Client requests never transmit `userId`. Any `userId` provided in a request payload is ignored and stripped during Zod validation. The active user is resolved strictly on the server through the secure helper `resolveCurrentUser()`.
2. **Compound Unique Constraints (`@@unique([id, userId])`):**
   By placing `@@unique([id, userId])` on `Project`, `Task`, and `Note`, Prisma can execute single-statement atomic updates and deletions:
   ```typescript
   // Guaranteed tenant-isolated mutation:
   const task = await prisma.task.update({
     where: {
       id_userId: { id: taskId, userId: authUser.id }
     },
     data: sanitizedInput,
   })
   ```
   If a user attempts to update or delete a record ID that belongs to another user, PostgreSQL fails to match the compound index and returns `P2025` (Record Not Found). No unauthorized access is possible.
3. **Cross-Entity Relationship Verification:**
   When a task or note is assigned to a `projectId`, the server enforces that the project belongs to the same user:
   ```typescript
   if (input.projectId) {
     const projectExists = await prisma.project.findUnique({
       where: { id_userId: { id: input.projectId, userId: authUser.id } },
       select: { id: true },
     })
     if (!projectExists) {
       return { success: false, error: "Referenced project does not exist or access denied." }
     }
   }
   ```
4. **Scoping All Reads:**
   Every query to PostgreSQL mandates `{ where: { userId: authUser.id } }`. Cross-tenant queries are structurally prevented.

---

## 5. Pre-Authentication Development Strategy (Phase 4 Demo User)

Authentication is formally scheduled for **Phase 5**. Phase 4 requires a safe, deterministic development environment that operates with real PostgreSQL persistence without introducing security backdoors into production.

### 5.1 Architecture of the `resolveCurrentUser()` Abstraction

All Server Actions retrieve user identity through a centralized helper located in `src/lib/auth-context.ts`:

```typescript
// src/lib/auth-context.ts
import { prisma } from "@/lib/prisma"

export const DEMO_USER_ID = "usr_demo_nexora_dev"
export const DEMO_USER_EMAIL = "alex.rivera@nexora.dev"

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
}

export async function resolveCurrentUser(): Promise<AuthenticatedUser> {
  // ── PRODUCTION SAFEGUARD ──
  if (process.env.NODE_ENV === "production") {
    // In Phase 5, this will be: const session = await auth(); return session.user;
    // For Phase 4, production MUST reject unauthenticated access:
    throw new Error("UNAUTHORIZED: Authentication is required in production environments.")
  }

  // ── DEVELOPMENT DEMO USER ──
  // Check or lazily create deterministic demo user in PostgreSQL
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: "Alex Rivera",
      title: "Senior Full-Stack Developer",
      initials: "AR",
      preferences: {
        create: {
          defaultView: "dashboard",
          taskDensity: "comfortable",
          confirmBeforeDelete: true,
        },
      },
    },
    select: { id: true, email: true, name: true },
  })

  return { id: user.id, email: user.email, name: user.name || "Alex Rivera" }
}
```

### 5.2 Phase 5 Seamless Handover Plan
When Auth.js (NextAuth v5) is introduced in Phase 5:
1. `resolveCurrentUser()` will be updated in one place:
   ```typescript
   import { auth } from "@/auth"
   export async function resolveCurrentUser(): Promise<AuthenticatedUser> {
     const session = await auth()
     if (!session?.user?.id) throw new Error("UNAUTHORIZED")
     return { id: session.user.id, email: session.user.email!, name: session.user.name! }
   }
   ```
2. **Zero code changes** will be required in any Server Action (`project.actions.ts`, `task.actions.ts`, etc.) or in `DataContext`, as all actions interact exclusively with `resolveCurrentUser()`.

---

## 6. Migration Reliability, Batching & Safe Resume Protocol

### 6.1 Server-Side Execution Model & Timeout Realities
Closing a browser tab or navigating away terminates the client HTTP connection, but **it does not automatically roll back a server-side database transaction** once Next.js has passed execution to Node.js and PostgreSQL. Furthermore, serverless databases (Neon) and Vercel serverless execution limits (typically 10s to 15s) mean that a single monolithic transaction attempting to migrate hundreds of projects, tasks, and notes simultaneously risks hitting database connection timeouts or function timeouts.

To achieve enterprise-grade reliability, migration is engineered as a **chunked, idempotent batch pipeline** with independent transaction boundaries.

### 6.2 Chunked Pipeline & Batch Sizing
The migration payload is split into discrete stages executed sequentially:
1. **Stage 1: User Profile & Preferences** (1 transaction)
2. **Stage 2: Projects** (Batches of 50 projects per transaction)
3. **Stage 3: Tasks** (Batches of 50 tasks per transaction, linking to migrated `projectId`s)
4. **Stage 4: Notes** (Batches of 50 notes per transaction)
5. **Stage 5: Finalization & Timestamp Stamp** (1 transaction)

Each batch executes inside its own dedicated transaction with a strict 8-second timeout:
```typescript
await prisma.$transaction(async (tx) => { ... }, { timeout: 8000 })
```

### 6.3 Idempotency via Compound Unique Keys
Every entity write in every batch utilizes `upsert` keyed on `id_userId`:
```typescript
await tx.task.upsert({
  where: { id_userId: { id: task.id, userId: user.id } },
  update: {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    projectId: task.projectId,
  },
  create: {
    id: task.id,
    userId: user.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    projectId: task.projectId,
  },
})
```
**Idempotency Guarantee:** If Batch 1 (Projects) and Batch 2 (Tasks 1–50) succeed, but Batch 3 (Tasks 51–100) fails due to a network glitch:
- The already migrated records remain intact and valid.
- When the user retries or resumes, the entire pipeline or failed batch can re-run safely.
- Succeeded records are simply updated/skipped; zero duplicates are created, and zero foreign-key constraint violations can occur.

### 6.4 Progress Tracking with `MigrationLog`
The `MigrationLog` table maintains an audit trail and state machine:
- Fields: `stage`, `batchIndex`, `totalBatches`, `projectsCount`, `tasksCount`, `notesCount`, `status` (`IN_PROGRESS` | `COMPLETED` | `FAILED`), and `error`.
- At the start of migration, a log row is created with status `IN_PROGRESS`.
- After each successful batch, `MigrationLog` updates its `batchIndex` and `stage`.
- If an error occurs, `MigrationLog` updates with status `FAILED` and records `error.message`.
- Upon full completion, `MigrationLog` sets status `COMPLETED` and `User.migrationCompletedAt` is stamped.

### 6.5 Safe Resume Protocol for Interrupted Migrations
1. **Mount Check:** On application mount, if `localStorage` has unmigrated data, `DataContext` calls `checkMigrationStatusAction()`.
2. **Interruption Detection:** If a `MigrationLog` exists with status `IN_PROGRESS` or `FAILED`, the server reports which stage and batch were successfully completed.
3. **User Prompt & Recovery UI:** The UI displays a non-intrusive recovery banner:
   > *"Migration interrupted: 42 of 75 items synchronized. [Resume Migration] [Keep Local Only]"*
4. **Resuming:** Clicking **Resume Migration** dispatches `resumeMigrationAction()`, which resumes processing from the uncompleted batch index.
5. **Non-Destructive Local Storage:** Original `localStorage` data is never deleted. A timestamped local backup (`nexora:backup:[userId]:[timestamp]`) is permanently preserved in browser storage.

---

## 7. Deep Technical Specifications

### 7.1 Kanban Ordering Precision & Safe Rebalancing

#### Midpoint Value Calculation Formula
When a task is dragged to a new position, its `order` is computed using double-precision float arithmetic:
1. **Initial Spacing:** Tasks in freshly initialized or seeded columns receive spaced values:
   $$\text{order}_i = (i + 1) \times 1000.0 \quad (1000.0, 2000.0, 3000.0, \dots)$$
2. **Drop Between Tasks $A$ and $B$:**
   $$\text{order}_{\text{new}} = \frac{A.\text{order} + B.\text{order}}{2}$$
3. **Drop at Column Head (Before First Task $B$):**
   - If $B.\text{order} > 1.0$: $\text{order}_{\text{new}} = \max(0.0, B.\text{order} - 1000.0)$
   - If $B.\text{order} \le 1.0$: $\text{order}_{\text{new}} = \frac{B.\text{order}}{2}$
4. **Drop at Column Tail (After Last Task $A$):**
   $$\text{order}_{\text{new}} = A.\text{order} + 1000.0$$
5. **Drop into Empty Column:**
   $$\text{order}_{\text{new}} = 1000.0$$

#### Precision Threshold & Trigger
JavaScript numbers are IEEE 754 double-precision floats with 53 mantissa bits (~15-17 significant decimal digits). Repeated halving between cards reduces the gap exponentially ($\frac{1000}{2^n}$).
- **Precision Threshold:** When $|B.\text{order} - A.\text{order}| < 0.001$, the gap is considered degraded.
- **Action:** The Server Action executes the requested task move using the computed midpoint, and then triggers an asynchronous column rebalancing routine.

#### Safe Column Rebalancing Routine
- **Isolation:** Rebalancing is strictly scoped to the single affected column: `(userId, status)`. It does NOT touch any other column or user.
- **Transaction Requirement:** Column rebalancing **requires an atomic transaction** (`prisma.$transaction`) to prevent dirty reads or transient sort inversions:
  ```typescript
  export async function rebalanceColumnOrders(userId: string, status: TaskStatus): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const columnTasks = await tx.task.findMany({
        where: { userId, status },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      })

      for (let i = 0; i < columnTasks.length; i++) {
        await tx.task.update({
          where: { id_userId: { id: columnTasks[i].id, userId } },
          data: { order: (i + 1) * 1000.0 },
        })
      }
    })
  }
  ```

#### Concurrency & Tie-Breaking
- If two browser tabs move cards simultaneously into the same slot, the database index `@@index([userId, status, order])` handles sorting.
- In the rare event that two tasks receive identical float orders, queries order by `order: "asc"` followed by `createdAt: "asc"` as a deterministic tie-breaker. Cards will never jump positions randomly.

---

### 7.2 Date-Only Semantics (`dueDate` vs Temporal Timestamps)

#### The Problem of Timezone Shifting
A task due date (e.g., *"November 15, 2026"*) represents a pure calendar date, not an exact instant in time. If a date is stored as a full UTC timestamp (`2026-11-15T00:00:00.000Z`), a user in New York (UTC-5) reading that timestamp in local time sees `2026-11-14 19:00:00` — the date appears to have shifted one day backward!

#### Database Type: `@db.Date`
To solve this permanently:
- **`Task.dueDate` is defined as `DateTime? @db.Date` in Prisma.**
- In PostgreSQL, `@db.Date` maps to native `DATE` storage (4 bytes, year-month-day only), with no time component and no timezone offset.
- In contrast, audit fields (`createdAt`, `updatedAt`, `timestamp`) use `DateTime` (PostgreSQL `TIMESTAMPTZ`) to record exact worldwide instants.

#### Serialization & Formatting Rules
1. **Wire Format (Server Actions & API):**
   - Client-to-server and server-to-client serialization of `dueDate` is strictly an ISO-8601 Date string: `"YYYY-MM-DD"` (e.g. `"2026-11-15"`), or `null`.
2. **Server Action Ingestion:**
   - Zod validation enforces: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()`.
   - Ingested string `"2026-11-15"` is parsed into UTC midnight `new Date("2026-11-15T00:00:00.000Z")` before Prisma write, ensuring PostgreSQL receives the exact calendar date.
3. **Server Action Egress:**
   - When returning a task to the client, the Date is formatted back:
     ```typescript
     dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null
     ```
4. **Client-Side Rendering:**
   - Frontend components (`Calendar`, `TaskCard`, `TaskDialog`) treat `dueDate` strictly as `"YYYY-MM-DD"`.
   - The tested `formatLocalDate()` helper parses the date by string splitting `[year, month, day]`, guaranteeing that the user sees "Nov 15" regardless of their browser timezone.

---

### 7.3 Dynamic Project Progress (No Stored Derived State)
- `Project` model contains **no `progress` column**.
- Progress is computed dynamically:
  $$\text{progress} = \text{round}\left(\frac{\text{completed tasks in project}}{\text{total tasks in project}} \times 100\right)$$
- Eliminates state drift bugs where deleting or editing a task fails to update a cached project number.
- `DataContext` computes progress in real time via `getProjectProgress(projectId)`.

---

## 8. Offline & Synchronization State Machine

### 8.1 Explicit Frontend Synchronization States
`DataContext` manages an explicit, observable synchronization state machine:

```typescript
export type SyncState =
  | "SYNCED"        // Authoritative state: PostgreSQL is reachable and all changes are persisted.
  | "SYNCING"       // Mutation or migration is currently in flight to the server.
  | "OFFLINE_LOCAL" // PostgreSQL is unreachable (timeout/offline). Running on localStorage.
  | "SYNC_FAILED"   // Mutation rejected by server (validation or constraint failure).
```

### 8.2 Topbar Sync Status Indicator
A dedicated, persistent pill in the application Topbar displays the live state:
- **`SYNCED`**: Green indicator + *"Synced with Cloud"*
- **`SYNCING`**: Blue pulsing indicator + *"Syncing changes..."*
- **`OFFLINE_LOCAL`**: Amber indicator + *"Offline Mode (Saved Locally Only)"*
- **`SYNC_FAILED`**: Red indicator + *"Sync Failed — Reverted"*

> [!CAUTION]
> **Zero False-Positive Rule:** The application will **never** display a "Saved" or "Synced" confirmation if data was only written to `localStorage`. If the database request fails or times out, the UI transitions visibly to `OFFLINE_LOCAL`.

### 8.3 Optimistic Updates & Failure Handling

```
User triggers action (e.g. edit task)
             │
             ▼
1. Take immutable snapshot of state
   const snapshot = { tasks, projects, notes }
             │
             ▼
2. Apply optimistic update to React state & localStorage
   setTasks(optimisticTasks)
   setSyncState("SYNCING")
             │
             ▼
3. Dispatch Server Action (updateTaskAction)
             │
     ┌───────┴────────────────────────┐
     ▼                                ▼
[SUCCESS]                        [FAILURE]
setSyncState("SYNCED")                 │
Update confirmed in DB       ┌─────────┴─────────┐
                             ▼                   ▼
                     [Network / DB Offline]  [Validation / Constraint Error]
                     - Retain local changes  - Revert state to snapshot
                     - setSyncState(         - setSyncState("SYNC_FAILED")
                         "OFFLINE_LOCAL")    - Show destructive error toast
                     - Toast: "Saved locally - User alerted of invalid data
                       only. Reconnecting..."
```

### 8.4 Circuit-Breaker for Database Unavailability
Server Actions implement an internal 5-second timeout on Prisma database operations.
If Neon PostgreSQL is suspended, cold-starting beyond the threshold, or unreachable:
1. The Server Action catches the timeout error and returns `{ success: false, isOffline: true, error: "DATABASE_UNAVAILABLE" }`.
2. `DataContext` detects `isOffline: true`, preserves the user's optimistic edit in `localStorage`, marks `syncState = "OFFLINE_LOCAL"`, and initiates a gentle background reconnection check (every 30 seconds).
3. When connectivity returns, a silent synchronization pass reconciles local changes with the database.

---

## 9. Critical Architecture Decisions & Rationale

| Decision | Context & Alternative Considered | Chosen Approach | Rationale |
|---|---|---|---|
| **1. Database-Level Multi-Tenant Isolation** | Alternative: Check `userId` in application code before raw `update({ where: { id } })`. | Add `@@unique([id, userId])` to `Project`, `Task`, and `Note`. Use compound keys in Prisma operations. | Eliminates race conditions and authorization bypasses at the database engine level. If `userId` does not match, PostgreSQL rejects the query immediately. |
| **2. Demo User Architecture** | Alternative: Hardcode client-side demo ID or allow unauthenticated writes directly. | Centralize server identity resolution in `resolveCurrentUser()`. Enforce strict production block (`NODE_ENV === "production"`). | Provides a seamless development experience for Phase 4 while ensuring zero authentication bypass risks can reach production. Allows 100% reusable Server Actions for Phase 5. |
| **3. Chunked Batch Migration with Safe Resume** | Alternative: Monolithic single-transaction migration of all records. | Split migration into batches of 50 items with independent transactions, `MigrationLog` stage tracking, and idempotent `upsert`. | Prevents serverless function timeouts and connection exhaustion. Guarantees that interrupted migrations can be safely resumed without duplicate records. |
| **4. Date-Only Semantics (`@db.Date`)** | Alternative: Store due dates as `TIMESTAMPTZ` with `00:00:00` UTC. | Use `DateTime? @db.Date` in PostgreSQL with strict `"YYYY-MM-DD"` serialization. | Completely eliminates timezone day-shifting bugs across international client timezones. Separates calendar concepts from temporal audit timestamps. |
| **5. Float Kanban Ordering with Isolated Rebalance** | Alternative: Integer sequence reordering (`order: 0, 1, 2...`). | Store `order Float @default(0.0)`. Use midpoint calculations for moves; trigger column-isolated rebalancing in a transaction when $\Delta < 0.001$. | Minimizes database write amplification ($O(1)$ single-row updates during normal moves), while guaranteeing numeric precision and deterministic sorting. |
| **6. Explicit 4-State Sync Lifecycle** | Alternative: Binary online/offline boolean with silent local writes. | Formal state machine (`SYNCED`, `SYNCING`, `OFFLINE_LOCAL`, `SYNC_FAILED`) with persistent Topbar indicator and snapshot rollbacks. | Enforces transparency: users are never misled into believing an offline change has reached the cloud database. Protects data integrity. |

---

## 10. Environment Setup & Configuration

### 10.1 Required Variables (`.env.local`)

```env
# ── Neon PostgreSQL Connection Strings ──
# Transaction Pooled connection string (used by app runtime & Server Actions)
DATABASE_URL="postgresql://[user]:[password]@[host]-pooler.[region].aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Direct connection string (used by Prisma CLI for migrations & schema pushing)
DIRECT_URL="postgresql://[user]:[password]@[host].[region].aws.neon.tech/neondb?sslmode=require"

# ── App URL ──
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 10.2 Step-by-Step Neon Database Setup Instructions:
1. Navigate to **[https://console.neon.tech](https://console.neon.tech)** and sign in.
2. Click **Create Project**, name it `nexora-devhub`, select PostgreSQL 16, and pick your preferred region.
3. On the project dashboard, locate the **Connection Details** box.
4. Toggle the connection type between **Pooled connection** and **Direct connection**.
5. Copy both connection strings into `.env.local` as `DATABASE_URL` and `DIRECT_URL`.
6. Run `npx prisma db push` or `npx prisma migrate dev` to deploy the schema.

---

## 11. Implementation Roadmap & Milestones

```
Phase 4 Roadmap
  │
  ├── Milestone 1: Architecture & Planning (Fully Refined & Approved) ◄── [YOU ARE HERE]
  │
  ├── Milestone 2: Prisma ORM Setup & Database Schema
  │   - Install prisma & @prisma/client
  │   - Configure schema.prisma with @db.Date, compound unique keys, and indexes
  │   - Initialize singleton client (src/lib/prisma.ts)
  │   - Execute first database migration against Neon
  │   - Build database seeder (prisma/seed.ts)
  │
  ├── Milestone 3: Zod Validation & Server Actions Layer
  │   - Implement Zod schemas with Date-only regex and ownership checks
  │   - Create Server Actions for Projects, Tasks (with midpoint order & rebalance), Notes, Settings
  │   - Implement resolveCurrentUser() with production safeguards
  │   - Implement typed response envelopes & circuit-breaker timeouts
  │
  ├── Milestone 4: Full-Stack Integration & Chunked Migration
  │   - Connect DataContext to Server Actions with 4-state sync lifecycle
  │   - Implement chunked, idempotent batch migration with MigrationLog tracking
  │   - Implement optimistic UI updates with automatic snapshot rollback on error
  │   - Implement OFFLINE_LOCAL fallback with zero false-positive saves
  │
  └── Milestone 5: Verification & Quality Assurance
      - Test all CRUD actions against PostgreSQL with verified user isolation
      - Verify multi-tenant security boundary & Date-only timezone stability
      - Test offline recovery, rebalancing, and migration resume
      - Run lint, TypeScript, and production build checks
```

---

*Phase 4 Milestone 1 document is fully refined. Awaiting your approval before proceeding to Milestone 2 (Prisma setup and schema creation).*
