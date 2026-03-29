# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
```

No test runner is configured.

## Architecture

### Tech Stack
- **Next.js 16.2** (App Router) + **React 19**
- **Supabase** (Postgres + Auth) via `@supabase/ssr`
- **Tailwind CSS 4** + Radix UI + next-themes
- **Anthropic SDK** for AI features
- All UI text is in **Dutch**

### Route Groups
```
src/app/
  (auth)/         → login, change-password, invite/[token]
  (dashboard)/    → /dashboard (project picker)
  (admin)/        → /admin (super admin)
  (project)/      → /project/[projectId]/... (all project pages)
```

### Project Layout Pattern
`src/app/(project)/project/[projectId]/layout.tsx` is a **server component** that:
- Authenticates the user and fetches project + currentMember + standbyTeams in parallel
- Renders `<ProjectHeader>` (top bar with sub-nav tabs) + `<ProjectSidebar>` (dark collapsible sidebar)
- All child pages receive layout context automatically — **pages must NOT fetch project/member/standbyTeams themselves**
- Pages use `<main className="h-full overflow-y-auto ...">` (not `flex-1`)

### Navigation structure
- **ProjectSidebar** (`src/components/layout/ProjectSidebar.tsx`): module-level nav (Logboek, Gastenlijst, Artiesten, Materieel, Instellingen). Collapsible, persists state in `localStorage('ims-sidebar-collapsed')`.
- **ProjectHeader** (`src/components/layout/ProjectHeader.tsx`): breadcrumb + logbook sub-nav tabs (Logboek · Dashboard · Area's · Weer · Info). Info tab only shown for admins.
- Dashboard, Areas, Weer, Info are **sub-pages of Logboek**, not separate modules.

### Module system
`src/lib/utils/modules.ts` defines `ModuleKey` and `MODULE_CONFIG`. The `active_modules text[]` column on the `projects` table controls which sidebar modules are shown. `logbook` and `settings` are always visible.

### Supabase clients
- **Server**: `src/lib/supabase/server.ts` → `createClient()` (async, uses cookies)
- **Client**: `src/lib/supabase/client.ts` → browser-side
- **Admin**: `src/lib/supabase/admin.ts` → service role key, bypasses RLS

### Server Actions
All mutations live in `src/lib/actions/`. Use `'use server'` functions called directly from client components or forms. Key actions:
- `log.actions.ts` — createLog, updateLog, closeLog, etc. (largest file)
- `auth.actions.ts` — login, logout, invite flow
- `notification.actions.ts` + `push.actions.ts` + `reminder.actions.ts` — notification system

### Key types (`src/types/app.types.ts`)
- `UserRole`: `super_admin | company_admin | centralist | planner | runner`
- `canAdmin` = role is `super_admin` or `company_admin`
- `Project.active_modules: string[]` — feature flags
- `DisplayMode`: `dynamic | fixed | cp_org`
- `LogPriority`: `info | low | mid | high`

### Database migrations
Migrations live in `supabase/migrations/`. Can be applied via the Supabase Management API:
```
POST https://api.supabase.com/v1/projects/{ref}/database/query
Authorization: Bearer $SUPABASE_MANAGEMENT_API_TOKEN
```
Token is stored in `.env.local` as `SUPABASE_MANAGEMENT_API_TOKEN`.

### Time / shift logic
The shift starts at **07:00 Amsterdam time** (`Europe/Amsterdam`). Dashboard hourly charts group logs from shift start to now.
