# TaskFlow — Collaborative Project Management Platform

TaskFlow is a modern, real-time Kanban project management web application built with React (JavaScript/JSX), Vite, Tailwind CSS v4, Zustand, `@dnd-kit`, `date-fns`, and Recharts.

## Key Capabilities

- **Authentication & Profiles**: Google Sign-In, Email/Password login, registration, password reset, protected routes, session persistence, and profile/avatar management.
- **Workspaces & RBAC**: Create, edit, and switch workspaces; invite members via email; enforce **Owner**, **Admin**, **Member**, and **Viewer** permissions at the database security rule layer.
- **Boards & Templates**: Launch boards from 6 curated templates (*Project Management*, *Website Development*, *Marketing Campaign*, *College Assignment*, *Personal Productivity*, *Event Management*) or a Blank Kanban board with custom themes and visibility settings.
- **Interactive Kanban & Drag-and-Drop**: Reorder lists, reorder tasks within a column, and move tasks across columns using `@dnd-kit` with smooth drag overlays, drop indicators, fractional position rebalancing, and optimistic rollback on errors.
- **Task Detail Modal**: Edit title, description, status, priority, due date, multiple assignees, labels, checklists with live progress tracking, link attachments, comments with `@mentions`, activity logs, duplicate, archive, and delete.
- **Analytics Dashboard & Calendar**: Live KPI metrics, 4 Recharts visualizations (Completion Rate, Weekly Trends, Tasks by Status, Tasks by Priority), upcoming deadlines, recent activity feed, and Monthly / Weekly / Daily calendar views.
- **Notifications & Dual Theme**: Real-time in-app notifications dropdown + inbox, mark read / mark all read, Light & Dark modes, and collapsible responsive sidebar.

## Getting Started

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`.

### Running Tests

```bash
npx --yes tsx --test src/utils/kanban.test.js firestore.rules.test.ts
npx eslint firestore.rules
```

## Database & Backend Configuration

### 1. Live Firebase Firestore & Auth (Pre-configured)
This workspace is connected to Firebase Auth and Cloud Firestore via `firebase-applet-config.json` with hardened security rules deployed in `firestore.rules` (enforcing PII isolation, verified users, schema validation, and Owner/Admin/Member/Viewer RBAC).

> **Note on Email/Password Sign-In**: Google Sign-In works immediately. To also allow Email/Password registration in your Firebase project, enable **Email/Password** in **Firebase Console → Authentication → Sign-in method**.

### 2. Supabase PostgreSQL Migrations (Included)
Complete PostgreSQL migrations for all 16 normalized tables, indexes, triggers, Realtime publications, Row Level Security (RLS), and Storage bucket policies are included in:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

To connect your own Supabase project:
1. Run `001_initial_schema.sql` followed by `002_rls_policies.sql` in the **Supabase SQL Editor**.
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Never expose your Supabase `service_role` key in the frontend.
