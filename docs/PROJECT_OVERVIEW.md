# NEXORA DevHub — Project Overview

> **Production URL:** [https://noxora-dev.vercel.app](https://noxora-dev.vercel.app)  
> **Source Repository:** [https://github.com/mazen-alkhadami/noxora-dev](https://github.com/mazen-alkhadami/noxora-dev)  
> **Engineered By:** Mazen Al-Khadami  
> **Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Prisma v6, Neon PostgreSQL, Auth.js v5

---

## 1. Executive Summary

**NEXORA DevHub** is a production-grade, multi-tenant SaaS project and task management platform engineered specifically for software engineers, engineering managers, and independent technical creators.

Modern engineering initiatives often suffer from tool fragmentation: teams juggle separate tools for issue tracking, Kanban sprint boards, sprint scheduling, and architectural documentation. NEXORA DevHub consolidates this entire workflow into a cohesive, high-performance workspace while enforcing strict data isolation, zero-trust security boundaries, and optimistic, low-latency UI responsiveness.

---

## 2. Problem Statement & Engineered Solution

### The Problem
1. **Tool Overload & Context Switching:** Developers constantly bounce between disconnected tools (Jira, Trello, Google Calendar, Notion), fragmenting sprint context.
2. **Data Leakage in Multi-Tenant Apps:** Many multi-tenant applications fail to isolate data at the database query level, inadvertently exposing organizational data through sloppy foreign key checks.
3. **Sluggish, Inconsistent UIs:** Heavy SPA frameworks or poorly architected server-rendered apps result in jarring page flickers, layout shifts, or desynchronized state when dragging items across sprint boards.
4. **Security Vulnerabilities:** Naive authentication setups suffer from token forgery, lack of session revocation upon password reset, race conditions in rate limiting, and open-redirect vulnerabilities.

### The Engineered Solution
- **Unified Engineering Workspace:** Centralizes Projects, Tasks, Kanban, Scheduling, and Technical Notes under a single responsive dashboard.
- **Guaranteed Tenant Isolation:** Every single database query strictly requires an authenticated user identity resolved server-side through `@/lib/auth-context`. Foreign keys enforce strict referential boundaries.
- **Optimistic State with Real-Time Database Sync:** React 19 optimistic updates powered by centralized client context provide instantaneous UI reactions with background Server Action synchronization and automatic rollback on network failure.
- **Hardened Production Security:** Distributed advisory rate limiting via PostgreSQL (`pg_advisory_xact_lock`), atomic session revocation with incremented version integers, bcrypt password hashing, and strict edge middleware route guards.

---

## 3. Target User Personas

| Persona | Primary Needs | How NEXORA DevHub Solves It |
| :--- | :--- | :--- |
| **Solo Software Engineer** | Track side projects, organize backlog, take technical notes | Lightweight, zero-distraction UI with TipTap markdown editor and fast task triage. |
| **Engineering Lead / Scrum Master** | Monitor sprint velocity, review blockers, organize milestones | Kanban drag-and-drop workflow stages with real-time column counts and monthly schedule views. |
| **Freelance Consultant** | Multi-client project segregation, milestone planning | Multi-tenant isolation guarantees no cross-project contamination; color-coded workspace labels. |
| **Technical Founder / Creator** | Central source of truth for architectural specs and product roadmap | Unified dashboard metrics, project progress bars, and persistent activity history. |

---

## 4. Core Capabilities Map

```
NEXORA DevHub
├── 1. Authentication & Security
│   ├── Email / Password Registration & Verification
│   ├── Auth.js v5 JWT Session with Atomic Session Versioning
│   ├── Edge Middleware Route Interception (/dashboard/*)
│   ├── Distributed Rate Limiting via PostgreSQL Advisory Locks
│   └── Sanitized Open-Redirect Protection
│
├── 2. Workspace & Initiatives (Projects)
│   ├── Project Creation with Color Customization & Status Lifecycle
│   ├── Real-time Completion Progress Aggregation (% calculation)
│   ├── Dual View Options (Responsive Grid vs Dense List)
│   └── Multi-Criteria Search & Status Filtering
│
├── 3. Sprint Execution (Tasks & Kanban)
│   ├── Task CRUD with Deadlines, Priorities, and Project Assignment
│   ├── 4-Column Drag-and-Drop Kanban Board (@dnd-kit)
│   ├── 5px Sensor Threshold to Prevent Accidental Drags
│   └── Optimistic Column Transitions & Live State Sync
│
├── 4. Milestone Schedule (Calendar)
│   ├── Interactive Monthly Matrix with Day Cell Task Badges
│   ├── UTC ISO 8601 Timestamp Normalization (Zero Date Drift)
│   └── Overdue Task Indicators & Deadline Tracking
│
├── 5. Architectural Knowledge Base (Notes)
│   ├── TipTap Rich-Text Editor with Markdown Syntax
│   ├── Project-Bound Technical Specifications & Sprint Notes
│   └── Dynamic Client-Side Code Splitting
│
└── 6. User Preferences & Settings
    ├── Profile Management with Automated Avatar Initials
    ├── Dark Mode / Light Mode Theme Switching
    └── WCAG 2.1 Level AA Accessibility Standards
```

---

## 5. Technical Specifications & Quality Gates

- **Framework:** Next.js 15.5 App Router with React 19 Server and Client Components.
- **Database:** Serverless Neon PostgreSQL with dual connection management (PgBouncer pooled runtime + Direct migration endpoint).
- **ORM:** Prisma v6 with strictly defined relation schemas and cascade behaviors.
- **Code Standards:** 100% TypeScript in strict mode, zero `any` evasions in core domain, automated ESLint 9 checks.
- **Responsiveness:** Validated across viewports from 375px (mobile) to 1440px (wide desktop).
- **Automated Verification:** Full Puppeteer E2E browser automation verifying live registration, project CRUD, Kanban sync, and tenant isolation on production.

---

## 6. Project Engineering Journey (Phases 1–10)

1. **Phase 1 — Architecture & Schema Design:** Established the multi-tenant Prisma schema, Next.js App Router scaffolding, and design system tokens.
2. **Phase 2 — UI/UX Component System:** Built atomic UI components using Tailwind CSS and Radix UI primitives.
3. **Phase 3 — Core Features (Milestone 1):** Implemented Projects, Tasks, and Dashboard analytics with client-side state.
4. **Phase 4 — Server Actions & Database Persistence:** Replaced client-only state with server-side database persistence, foreign keys, and Neon integration.
5. **Phase 5 — Production Authentication:** Replaced mock identity with multi-user Auth.js v5 authentication, bcrypt hashing, and registration flows.
6. **Phase 6 — Production Security Hardening:** Implemented distributed PostgreSQL rate limiting, JWT session versioning, and open-redirect defenses.
7. **Phase 7 — UI/UX Polish & Accessibility:** Added dark/light mode switching, responsive 375px layouts, WCAG 2.1 AA focus rings, and zero hydration warnings.
8. **Phase 8 — Deployment & Production Setup:** Deployed to Vercel with Neon PostgreSQL, dual connection pooling, and automated migration scripts.
9. **Phase 9 — Production Database Validation:** Resolved deployment migration edge cases and confirmed table creation on Vercel.
10. **Phase 10 — Portfolio & Documentation:** Engineered comprehensive technical documentation, architecture diagrams, and portfolio case studies.
