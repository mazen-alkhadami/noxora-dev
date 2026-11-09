# NEXORA DevHub — Feature Specifications

> **Production Application:** [https://noxora-dev.vercel.app](https://noxora-dev.vercel.app)  
> **Source Repository:** [https://github.com/mazen-alkhadami/noxora-dev](https://github.com/mazen-alkhadami/noxora-dev)  
> **Documentation Type:** Detailed Feature Catalog & Functional Specifications

---

## 1. Authentication & Security Subsystem

### 1.1 Multi-User Registration & Credentials Login
- **Secure Password Hashing:** User passwords are encrypted using `bcryptjs` with 12 computational rounds.
- **Strict Input Validation:** Form validation powered by `zod` enforces minimum 8 characters, alphanumeric requirements, and email normalization.
- **Auto-Login on Registration:** Newly registered users are immediately authenticated and smoothly redirected to `/dashboard`.
- **Sanitized Error Messaging:** Authentication failures display generic alerts (`"Invalid email or password"`) to prevent email enumeration attacks.

### 1.2 Session Management & Session Invalidation
- **Stateless JWT with Database Versioning:** Employs Auth.js v5 JWT session strategy with an atomic `sessionVersion` integer.
- **Session Revocation on Password Change:** Modifying or resetting a password increments the user's `sessionVersion` in PostgreSQL, instantly invalidating all existing active sessions across all devices.
- **Secure HTTPS Cookies:** Production deployment uses `__Secure-` cookie prefixes with `HttpOnly`, `SameSite=Lax`, and `Secure` attributes enabled.

### 1.3 Edge Route Protection & Middleware
- **Next.js Edge Middleware:** All routes under `/dashboard`, `/projects`, `/tasks`, `/kanban`, `/calendar`, `/notes`, and `/settings` are intercepted before rendering.
- **Open-Redirect Protection:** Callback URLs are strictly validated to prevent protocol-relative (`//attacker.com`) and backslash (`\attacker.com`) injection attacks.

### 1.4 Distributed Rate Limiting
- **PostgreSQL Advisory Lock Strategy:** Rate limits are tracked centrally in PostgreSQL using transaction-level advisory locks (`pg_advisory_xact_lock`), guaranteeing concurrency safety across multiple serverless instances without in-memory synchronization drift.

---

## 2. Projects & Workspace Initiatives

### 2.1 Project Lifecycle & Attributes
- **Project Metadata:** Every project stores a title, rich description, status (`ACTIVE`, `ON_HOLD`, `COMPLETED`, `ARCHIVED`), and custom hex color tag.
- **Color Tagging:** 10 curated developer color palettes (Indigo, Violet, Pink, Red, Amber, Green, Teal, Blue, Orange, Zinc) provide instant visual categorization.
- **Initiative Progress Aggregation:** The system dynamically computes the percentage of completed tasks relative to total tasks associated with each project.

### 2.2 Dual View Modes & Search
- **Grid View:** High-density card presentation featuring status badges, color ribbons, descriptions, and progress bars.
- **List View:** Compact, tabular layout tailored for large backlogs and fast scanning.
- **Real-Time Search & Filtering:** Case-insensitive search across project names and descriptions, complemented by quick status tabs (`All`, `Active`, `On Hold`, `Completed`, `Archived`).

---

## 3. Sprint Tasks & Priority Management

### 3.1 Task Attributes & Relations
- **Properties:** Title, detailed description, project assignment, status (`TODO`, `IN_PROGRESS`, `REVIEW`, `COMPLETED`), priority level, and optional due date.
- **Priority Tiers:** 
  - `LOW` (Muted gray)
  - `MEDIUM` (Informational blue)
  - `HIGH` (Warning amber)
  - `URGENT` (Destructive red)
- **Due Date Persistence:** Deadlines are stored in ISO 8601 UTC format, eliminating client-side timezone offset bugs.

### 3.2 Filtering & Quick Status Toggle
- **Instant Status Toggle:** Checkboxes allow one-click task completion from the task list with optimistic UI feedback.
- **Multi-Dimension Filters:** Filter tasks by associated project or priority level with real-time count badges.

---

## 4. Interactive Drag-and-Drop Kanban Board

### 4.1 Four-Stage Workflow
- **Columns:** `To Do` ➔ `In Progress` ➔ `In Review` ➔ `Completed`.
- **Column Header Counters:** Real-time badge indicators displaying the active count of tasks in each column.

### 4.2 Smooth Drag-and-Drop Mechanics (`@dnd-kit`)
- **Accidental Click Prevention:** Configured with a `PointerSensor` requiring a 5px movement threshold before drag initiates, preserving clickable links and task edit buttons.
- **Accessible Keyboard Reordering:** Integrated `KeyboardSensor` with `sortableKeyboardCoordinates` for full keyboard navigation.
- **Optimistic Column Transitions:** Dragging a card between columns updates the board instantly on drag release while dispatching `moveTaskAction` in the background.

---

## 5. Milestone Schedule & Calendar View

### 5.1 Interactive Monthly Matrix
- **Calendar Grid:** Displays current month days, leading/trailing days of adjacent months, and current date indicator.
- **Task Day Badges:** Displays interactive task badges directly inside the calendar cells for the corresponding due dates.
- **Overdue Task Highlighting:** Tasks whose deadlines are in the past and remain uncompleted are visually flagged in warning red.

---

## 6. Architectural Knowledge Base (TipTap Rich Notes)

### 6.1 Rich Text Editing
- **TipTap Core:** Powered by `@tiptap/react` and `@tiptap/starter-kit`.
- **Formatting Tools:** Bold, italic, strikethrough, headings (H1, H2, H3), bulleted lists, numbered lists, blockquotes, code blocks, and horizontal rules.
- **Code Splitting:** The TipTap editor bundle is dynamically loaded via Next.js `dynamic()` with SSR disabled, keeping the initial dashboard JavaScript payload minimal.

### 6.2 Project Binding
- **Contextual Documentation:** Notes can optionally be linked to a specific project workspace or remain standalone general engineering notes.

---

## 7. Dashboard Analytics & Real-Time Metrics

### 7.1 Statistical Summary
- **Total Projects:** Active and completed project metrics.
- **Task Velocity:** Total tasks, tasks in progress, completed tasks, and overall sprint completion rate.
- **Pending Deadlines:** Immediate visibility into tasks due within the current week or overdue.

### 7.2 Persistent Activity Feed
- **Audit Logging:** Automatically records actions (`CREATED`, `UPDATED`, `DELETED`, `COMPLETED`) across projects, tasks, and notes with timestamp and human-readable metadata.

---

## 8. User Profile, Settings & Themes

### 8.1 Personalization
- **Profile Customization:** Update display name, view registered email, and inspect tenant account IDs.
- **Automated Avatar Initials:** Dynamic initials generation (e.g., "Dr. Evelyn Reed" ➔ "ER") rendered in responsive circular avatar badges.

### 8.2 Dark Mode & Light Mode Theme Engine
- **Powered by `next-themes`:** Seamlessly toggles between Dark, Light, and System preferences.
- **Zero Hydration Warning:** Configured with `suppressHydrationWarning` and attribute-based CSS injection to prevent flash of unstyled content (FOUC).

### 8.3 Accessibility & WCAG 2.1 AA Compliance
- **Focus Rings:** Distinct, high-contrast 2px focus rings (`focus-visible:ring-2`) on all interactive buttons, inputs, dialogs, and navigation tabs.
- **Skip Link:** Screen-reader accessible "Skip to main content" link for rapid keyboard navigation.
- **Semantic HTML:** Correct ARIA roles (`role="dialog"`, `role="alert"`, `aria-label`) on all modals, alerts, and icon buttons.
