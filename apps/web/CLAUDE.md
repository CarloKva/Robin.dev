# apps/web — Gestionale Robin.dev

Leggi prima `/CLAUDE.md` (root). Questo file aggiunge le regole specifiche di `apps/web`.

## Stack

| Tech | Versione |
|------|----------|
| Next.js | ^15.1.3 (App Router) |
| React | ^19.0.0 |
| TypeScript | strict (exactOptionalPropertyTypes: true) |
| Tailwind CSS | ^3.4.17 |
| shadcn/ui | componenti in `components/ui/` |
| Clerk | @clerk/nextjs ^6.9.9 |
| Supabase | @supabase/supabase-js ^2.47.10, @supabase/ssr ^0.8.0 |
| Prisma | ^6.2.1 |
| Zod | ^3.24.1 |

## Struttura directory

```
apps/web/
├── app/
│   ├── (dashboard)/        — layout autenticato (Sidebar + Header + MobileNav)
│   │   ├── layout.tsx      — auth guard + workspace check
│   │   ├── dashboard/      — pagina principale
│   │   ├── tasks/          — lista task + [taskId]/ dettaglio
│   │   ├── backlog/        — backlog + sprint planning (BacklogJiraView)
│   │   ├── agents/         — lista agenti + [agentId]/ dettaglio
│   │   ├── metrics/        — metriche workspace
│   │   └── settings/       — impostazioni (GitHub, repositories)
│   ├── api/                — Route Handlers Next.js
│   │   ├── tasks/          — CRUD task + events
│   │   ├── sprints/        — CRUD sprint + start/complete
│   │   ├── agents/         — CRUD agenti + provisioning
│   │   ├── github/         — repos, enable/disable
│   │   ├── auth/github/    — OAuth callback GitHub App
│   │   ├── webhooks/github — ricezione webhook GitHub
│   │   ├── admin/          — bake-snapshot, update-agents (role: owner)
│   │   └── workspace/      — export GDPR
│   ├── onboarding/         — creazione workspace al primo accesso
│   └── sign-in/ sign-up/   — Clerk auth pages
├── components/
│   ├── ui/                 — componenti shadcn/ui puri (no business logic)
│   ├── backlog/            — BacklogJiraView + TaskRow + BulkActionBar + drawer
│   ├── tasks/              — TaskCard, EditableField, PRCard, DeployPreviewCard...
│   ├── dashboard/          — AgentHeroSection, MetricsTile, WorkspaceFeed...
│   ├── agents/             — AgentsClient, ProvisioningTimeline, AgentInfoPanel...
│   └── [ui-generici]       — Sidebar, Header, MobileNav, GlobalCreateModal...
├── lib/
│   ├── db/                 — data access layer (vedi sezione dedicata)
│   ├── api/requireWorkspace.ts — auth guard centralizzato per Route Handler
│   ├── supabase/           — server.ts, client.ts, admin.ts
│   ├── queue/              — BullMQ queue singletons per web
│   ├── events/             — narrativize.ts, trackUserAction.ts
│   ├── realtime/           — hook Supabase Realtime
│   ├── hooks/              — useKeyboardShortcut, useRelativeTime...
│   ├── tasks/descriptionQuality.ts
│   ├── task-constants.ts   — PRIORITY_ICONS, STATUS_LABELS, STATUS_COLORS
│   └── utils.ts            — cn() helper (clsx + tailwind-merge)
└── middleware.ts            — clerkMiddleware() + createRouteMatcher
```

## Autenticazione

### Pattern per Server Components e layout

```typescript
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";

const { userId } = await auth();
if (!userId) redirect("/sign-in");

const workspace = await getWorkspaceForUser(userId);
if (!workspace) redirect("/onboarding/workspace");
```

### Pattern per Route Handler (usa sempre requireWorkspace)

```typescript
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;
  // ...
}
```

`requireWorkspace()` — `lib/api/requireWorkspace.ts` — centralizza `auth()` + `getWorkspaceForUser()` e restituisce 401/404 se mancano.

### Pattern Clerk corretto

```typescript
// Corretto — sempre da @clerk/nextjs/server
import { auth } from "@clerk/nextjs/server";
const { userId } = await auth();
```

Mai usare import dinamico per Clerk in Server Components. Mai usare `currentUser()` nei Route Handler quando basta `auth()`.

## Data access

Le query Supabase stanno in `lib/db/`. Mai scrivere query inline in `page.tsx` o nei componenti.

| File | Contenuto |
|------|-----------|
| `workspace.ts` | `getWorkspaceForUser()`, `getWorkspaceById()`, `getWorkspaceMemberRole()` |
| `tasks.ts` | `getTasksForWorkspace(workspaceId, options)` con filtri e paginazione |
| `events.ts` | `getTaskTimeline()`, `getTaskProjectedState()` (wrapper DB) |
| `projectTaskState.ts` | `projectTaskState(events)` — funzione pura, nessun DB |
| `dashboard.ts` | `getDashboardMetrics()`, `getWorkspaceFeed()`, `getActiveTaskData()`, `getDashboardAgents()` |
| `agents.ts` | `getAgentsForWorkspace()`, `getOnlineAgentForWorkspace()`, `getActiveAgentStatus()` |
| `github.ts` | `getGitHubConnection()`, `upsertGitHubConnection()`, `getRepositoriesForWorkspace()`, `enableRepository()`, `disableRepository()` |
| `sprints.ts` | `getSprintsWithTasksForBacklog()` e CRUD sprint |
| `metrics.ts` | `getWorkspaceMetrics()`, `generateMonthlyReport()` |
| `backlog.ts` | query backlog non-sprint |
| `iterations.ts` | storico esecuzioni per task |
| `context.ts` | context documents (AI Brainstorm) |
| `task-templates.ts` | template descrizioni per tipo task |
| `workspace-settings.ts` | notifiche email/Slack |
| `reports.ts` | generazione report Markdown |

Pattern corretto per una nuova query:

```typescript
// lib/db/example.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getThingForWorkspace(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("things")
    .select("*")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return data ?? [];
}
```

`createSupabaseServerClient()` — `lib/supabase/server.ts` — client user-scoped con JWT Clerk. RLS enforced.

## Supabase client — quale usare

| Client | File | Quando usare |
|--------|------|--------------|
| `createSupabaseServerClient()` | `lib/supabase/server.ts` | Server Components, Route Handler — RLS enforced |
| `createBrowserClient()` | `lib/supabase/client.ts` | Client Components Realtime — RLS enforced |
| `createSupabaseAdminClient()` | `lib/supabase/admin.ts` | Solo operazioni admin (bypassano RLS) — mai in NEXT_PUBLIC |

## Route Handler — pattern standard

```typescript
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ title: z.string().min(1) });

export async function POST(request: Request) {
  // 1. Auth guard
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  // 2. Validazione input
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 3. Logica business (query in lib/db/)
  // ...

  // 4. Risposta
  return NextResponse.json({ data }, { status: 201 });
}
```

Gestione errori DB: loggare con `console.error("[POST /api/route] error:", err.message)`, restituire 500 con `{ error: err.message ?? "..." }`.

## TypeScript — regola exactOptionalPropertyTypes

`exactOptionalPropertyTypes: true` è attivo. Conseguenze:

```typescript
// Sbagliato — T | undefined non è assegnabile a T? quando il campo è undefined
type Props = { label?: string }
const label: string | undefined = undefined;
const p: Props = { label }; // ERRORE

// Corretto
const p: Props = { ...(label !== undefined && { label }) };

// Nei component props che ricevono valori potenzialmente undefined:
type Props = { label: string | undefined }  // non label?: string
```

## Realtime — pattern

```typescript
// Sempre setAuth PRIMA di subscribere
const token = await getToken({ template: "supabase" });
supabase.realtime.setAuth(token);

const channel = supabase
  .channel("channel-name")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "task_events",
    filter: `task_id=eq.${taskId}`,
  }, (payload) => {
    // Deduplica: controlla se payload.new.id è già nello state
    setEvents(prev =>
      prev.some(e => e.id === payload.new.id) ? prev : [...prev, payload.new]
    );
  })
  .subscribe();

// Cleanup obbligatorio
return () => { supabase.removeChannel(channel); };
```

Hook esistenti: `useTaskEventsFeed`, `useDashboardFeed`, `useAgentStatus`, `useActiveTask` in `lib/realtime/`.

## Known technical debt in questo package

- **BacklogJiraView.tsx è un god component** (728 righe). Non aggiungere logica. Se la task richiede modifiche significative a questo file, estrarre prima in componenti separati.
- **`GitHubEventJobPayload` definita localmente** in `apps/orchestrator/src/workers/github-events.worker.ts` invece che in `shared-types`. Fix pianificato in TASK-REFACTOR-ORC-06.
- **Prisma non ancora usato attivamente** — `lib/prisma.ts` esiste ma la maggior parte delle query usa Supabase direttamente. Non aggiungere query Prisma senza allineamento esplicito.
