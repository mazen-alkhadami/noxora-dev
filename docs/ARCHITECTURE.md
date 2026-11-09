# NEXORA DevHub — System Architecture Documentation

> **Production Application:** [https://noxora-dev.vercel.app](https://noxora-dev.vercel.app)  
> **Source Repository:** [https://github.com/mazen-alkhadami/noxora-dev](https://github.com/mazen-alkhadami/noxora-dev)  
> **Architecture Pattern:** Multi-Tenant Jamstack / Serverless Full-Stack Next.js 15 App Router

---

## 1. High-Level System Topology

NEXORA DevHub is architected as a modern serverless full-stack web application hosted on Vercel's global edge network and backed by Neon Serverless PostgreSQL.

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Browser)"]
        Browser["User Browser (Desktop / Mobile)"]
        LocalStorage["Client Storage (Optimistic Cache)"]
    end

    subgraph EdgeLayer ["Vercel Edge & Compute Network"]
        CDN["Vercel Global CDN (SSL / Assets)"]
        Middleware["Edge Middleware (src/middleware.ts)\n- Route Protection\n- Callback URL Validation"]
        AppRouter["Next.js 15 App Router (Serverless Node.js)\n- React Server Components\n- Server Actions\n- Auth.js v5 Handlers"]
    end

    subgraph SecurityLayer ["Security & Auth Subsystem"]
        AuthContext["Auth Context Guard (resolveCurrentUser)\n- JWT Session Decoding\n- sessionVersion Database Comparison"]
        RateLimiter["Distributed Rate Limiter\n- pg_advisory_xact_lock\n- Bounded Retries"]
    end

    subgraph DataLayer ["Data & Storage Layer (Neon PostgreSQL)"]
        PooledConn["Neon PgBouncer Connection Pooler\n(?pgbouncer=true)\n- Runtime Transactions\n- Server Action Queries"]
        DirectConn["Neon Direct Non-Pooled Endpoint\n- Prisma Migration Deploy\n- Schema Alterations"]
        Database[("PostgreSQL Database (neondb)\n- Users & Accounts\n- Projects & Tasks\n- Notes & Activities\n- Rate Limits & Migration Logs")]
    end

    Browser <-->|HTTPS / TLS 1.3| CDN
    CDN <--> Middleware
    Middleware <--> AppRouter
    AppRouter <--> AuthContext
    AppRouter <--> RateLimiter
    RateLimiter <--> PooledConn
    AppRouter <--> PooledConn
    PooledConn <--> Database
    DirectConn <--> Database
    Browser <--> LocalStorage
```

---

## 2. Request & Authentication Flow

Authentication is built with **Auth.js v5 (NextAuth)** configured with the `jwt` strategy and protected by custom session invalidation logic.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant MW as Edge Middleware
    participant SA as Server Action
    participant AC as resolveCurrentUser()
    participant DB as Neon PostgreSQL

    User->>MW: GET /projects (with Session Cookie)
    alt Unauthenticated or Invalid Cookie
        MW-->>User: 302 Redirect /login?callbackUrl=/projects
    else Authenticated JWT Present
        MW->>User: 200 OK (Render Dashboard Shell)
    end

    User->>SA: Invoke Server Action: createProjectAction(data)
    SA->>AC: Validate Caller Identity
    AC->>DB: Query User sessionVersion by ID
    alt sessionVersion mismatch (Password changed elsewhere)
        AC-->>SA: Throw "Session Revoked"
        SA-->>User: 401 Unauthorized / Session Expired
    else sessionVersion matches
        AC-->>SA: Returns Valid User { id, email }
        SA->>DB: INSERT INTO Project (userId, name, ...)
        DB-->>SA: Return Created Project Record
        SA-->>User: Return { success: true, data: project }
    end
```

---

## 3. Database Entity Relationship Diagram (ERD)

The database schema enforces multi-tenant referential integrity. All workspace resources (`Project`, `Task`, `Note`, `Activity`, `UserPreferences`) have an explicit foreign key relationship to the parent `User`.

```mermaid
erDiagram
    User ||--o{ Account : "has"
    User ||--o{ Session : "has"
    User ||--o{ Project : "owns"
    User ||--o{ Task : "owns"
    User ||--o{ Note : "owns"
    User ||--o{ Activity : "generates"
    User ||--o| UserPreferences : "configures"

    Project ||--o{ Task : "contains"
    Project ||--o{ Note : "associates"

    User {
        string id PK
        string name
        string email UK
        string password
        int sessionVersion "Defaults to 0, increments on password change"
        datetime emailVerified
        string image
        datetime createdAt
        datetime updatedAt
    }

    Project {
        string id PK
        string name
        string description
        string status "ACTIVE | ON_HOLD | COMPLETED | ARCHIVED"
        string color "Hex code"
        string userId FK
        datetime createdAt
        datetime updatedAt
    }

    Task {
        string id PK
        string title
        string description
        string status "TODO | IN_PROGRESS | REVIEW | COMPLETED"
        string priority "LOW | MEDIUM | HIGH | URGENT"
        datetime dueDate
        int orderIndex
        string projectId FK
        string userId FK
        datetime createdAt
        datetime updatedAt
    }

    Note {
        string id PK
        string title
        string content "Rich HTML from TipTap"
        string projectId FK
        string userId FK
        datetime createdAt
        datetime updatedAt
    }

    Activity {
        string id PK
        string action "CREATED | UPDATED | DELETED | COMPLETED"
        string entityType "PROJECT | TASK | NOTE"
        string entityId
        string entityName
        string metadata "JSON details"
        string userId FK
        datetime createdAt
    }

    RateLimit {
        string id PK
        string key UK
        int count
        datetime expiresAt
    }
```

---

## 4. Architectural Principles & Deep-Dives

### 4.1 Strict Multi-Tenant Isolation
Multi-tenancy in NEXORA DevHub is enforced at the database level rather than through logical UI filtering.
- **Identity Resolution (`src/lib/auth-context.ts`):** Every Server Action calls `resolveCurrentUser()`, which extracts the authenticated user ID directly from the validated session.
- **Query Scoping:** Every Prisma database operation explicitly mandates `where: { userId, id }` or `where: { userId }`.
- **Cross-Tenant Prevention:** An authenticated user cannot read, update, or delete another user's projects, tasks, or notes even if the target resource ID is known.

### 4.2 Session Revocation via `sessionVersion`
Traditional stateless JWTs cannot be revoked until they expire. NEXORA DevHub solves this without converting sessions to heavy stateful database records:
1. Every user record in PostgreSQL contains a `sessionVersion: Int @default(0)` field.
2. At authentication time, `sessionVersion` is embedded into the encrypted JWT token.
3. When sensitive operations occur (e.g., password reset, profile password update), the database atomically executes:
   ```ts
   await prisma.user.update({
     where: { id: userId },
     data: { sessionVersion: { increment: 1 } },
   })
   ```
4. On subsequent Server Action invocations, `resolveCurrentUser()` verifies that the JWT's `sessionVersion` matches the current database version. Any token issued prior to the password reset is instantly rejected.

### 4.3 Distributed Advisory Rate Limiting
In a serverless environment (such as Vercel), in-memory rate limiting fails because incoming requests land on different compute instances. NEXORA DevHub implements distributed rate limiting backed by PostgreSQL:
- Uses `pg_advisory_xact_lock(hashtext(key))` within an explicit transaction.
- Locks the specific rate-limiting key for the duration of the check and increment.
- Employs bounded retries with exponential backoff if a transient serialization conflict occurs.
- Automatically clears expired rate limit windows without accumulating stale database rows.

### 4.4 Dual Connection String Architecture (Neon + Prisma)
Serverless edge functions create and tear down connections rapidly, which can overwhelm standard PostgreSQL connection limits. NEXORA DevHub employs a dual connection strategy:
- **`DATABASE_URL` (Pooled Connection):** Connects through Neon's PgBouncer pooler (`-pooler.c-3.ap-southeast-1.aws.neon.tech?pgbouncer=true`). Handles standard web queries and Server Actions efficiently.
- **`DIRECT_URL` (Direct Connection):** Connects directly to the PostgreSQL instance without PgBouncer. Required by Prisma Migrate (`prisma migrate deploy`) because database migrations require advisory locks and prepared statements that PgBouncer transaction mode prohibits.

### 4.5 Optimistic UI State Synchronization
The UI combines React 19 client state with Server Action background persistence:
1. **Immediate Reaction:** When a user creates a project, moves a Kanban card, or updates a task, `src/context/data-context.tsx` updates client state instantly and writes to local storage for offline resilience.
2. **Background Persistence:** The action dispatches the corresponding Server Action asynchronously.
3. **Reconciliation:** Upon server response, temporary client IDs are replaced with permanent database IDs. If the server action returns an error, the client automatically rolls back to the previous snapshot.
