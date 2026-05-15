# Robin.dev — macOS Desktop Client Implementation Plan

**Status:** planning (no code yet)
**Author:** Claude Code, planning session 2026-05-15
**Source design:** `apps/desktop/design/Robin.dev/` (Babel-standalone React prototype, ~17 views + shell components)
**Companion reference (supersedes none of):** `docs/desktop-client-api-map.md` — REST + Realtime map, Italian, dated 2026-05-15.

---

## Executive summary

Robin.dev gets a downloadable macOS application that mirrors the gestionale's day-to-day surface as a menu-bar popover (Inbox · In progress · History · Robin chat · Task detail · Settings drawer) with an expanded full-window mode (per-agent chat · Settings sub-pages · Avatar Workshop · Capabilities). The client is a **read-and-orchestrate** panel — no agent execution runs locally, no repo is cloned client-side, no BullMQ is embedded. It talks to the same Vercel-hosted Route Handlers and the same Supabase Realtime channels the browser already uses, holding a Clerk-issued `supabase` JWT in macOS Keychain.

Scope of v1 is to ship the popover (Inbox, In progress, History, Task detail, Settings drawer), the expanded per-agent chat window, and the Settings · GitHub sub-page — plus native plumbing (tray icon, notifications on `agent.blocked` / `task.completed` / `task.failed` / `agent.pr.opened`, deep links, signed/notarized auto-updater). Capabilities, Avatar Workshop, Brains + Subscriptions matrix, Leaderboard / XP, and Robin orchestrator chat (`view-new-task`) are explicitly **deferred to v2** because each requires new backend surface or AI orchestration that does not yet exist.

The design source is implementation-ready visually but **silent on first-run, empty states, error states, multi-account, system theme, and global shortcuts** — those are the open questions for the founder before milestone work begins.

---

## Phase 1 — Design audit

### 1.1 Screen inventory

Order matches `Robin Desktop Client.html` artboards (`apps/desktop/design/Robin.dev/Robin Desktop Client.html:96-196`). Three are popover-mode (380×680), six are expanded-window (1100×680).

| # | File | Mode | Purpose | Primary actions | Status v1 |
|---|------|------|---------|-----------------|-----------|
| 01 | `view-inbox.jsx` | Popover (default landing) | Email-style digest of "letters from each engineer" — `shipped` / `review` / `failed`, one card per finished task. Read-only by design. | Read card, **Copy** card to clipboard, **Mark all read**, **Open web** | **v1 — in scope** (requires new backend projection) |
| 02 | `view-sprint.jsx` | Popover | Live snapshot of `in_progress` tasks; one card per WIP task with branch, repo, PR, priority, expandable description. | Expand/collapse, navigate to task detail, **Sprint board ↗** (deep-link to web) | **v1 — in scope** |
| 03 | `view-task-detail.jsx` | Popover | Read-only ADWP timeline for a single task. Quotes agent's `current_activity`. | Back, **Open chat ↗** (transitions to expanded window) | **v1 — in scope** |
| 04 | `view-new-task.jsx` | Popover | Natural-language orchestrator: "Chat with Robin.dev" assigns work in plain English with `@agent` override and `RepoSelector` dropdown. | Type and send, pick repo, tap suggestion | **v2 — deferred** (no backend) |
| 05 | `view-activity.jsx` | Popover | Git-style commit log grouped Today/Yesterday/Earlier, agent-hue lanes, merge halos, filter pills. | Filter (All/Merges/By engineer), drill-in | **v1 — in scope** |
| 06 | `view-settings-panel.jsx` | Popover | Drawer of settings cards — each previews what's editable on its expanded-window subpage. CTA to **Open settings ↗**. | Drill into a settings card | **v1 — in scope** (renders cards; only GitHub card is wired through to a working expanded subpage in v1) |
| Exp | `view-expanded.jsx` | Window 1100×680 | Three-column home: TeamRail · AgentChatPanel · LeaderboardRail. Centre column is a direct chat with one engineer's Claude Code instance. | Switch agent, send chat, tab Chat/Activity/Logs | **v1 partial** — chat thread + open-PRs strip only; leaderboard rail **deferred to v2** |
| 07 | `view-settings-agents.jsx` | Window (`SettingsShell`) | Team directory of 2-column profile cards with avatar pencil → Avatar Workshop. Exports `SettingsShell` used by every settings subpage. | Edit profile, Customize avatar, **Hire engineer** | **v2 — read-only listing only in v1; edit/hire/avatar deferred** |
| 08a | `view-settings-models.jsx` | Window | Subscriptions (API keys + caps + spend), workspace default brain picker, per-agent override matrix, auto-switch rule. | Connect/rotate keys, pick brain, override per agent | **v2 — entire surface deferred (no backend)** |
| 08b | `view-avatar-workshop.jsx` | Window | Dicebear `adventurer` configurator with Face/Hair/Extras tabs, breathing podium animation. | Cycle/pick variant, randomize, reset, save | **v2 — deferred** (column `agents.avatar_url` exists but no editor backend) |
| 10 | `view-capabilities.jsx` | Window | Marketplace of skill packs with categories, ratings, Official badges, installed-by avatar stack. | Filter, install/uninstall, **Build new**, **Open submissions** | **v2 — deferred** (no backend, `capability_definitions` exists but lacks marketplace fields) |
| 11 | `view-settings-github.jsx` | Window | GitHub connection card → repo list with enable toggles → per-repo environments (staging/production, branch mapping, auto-merge). | Connect/disconnect, search, toggle repos, manage environments | **v1 — in scope** (every endpoint already exists on web) |

**Not wired** in the canvas HTML:
- `view-agents.jsx` (legacy dark-theme variant, different status taxonomy — discard).
- `_v1-dark/view-disconnected.jsx` (v1 prototype, needs light-theme port for v1's disconnected state — keep as reference).
- `_v1-dark/*` (older variants — discard).

### 1.2 Component inventory

#### Shell / chrome (`popover-chrome.jsx`, `view-expanded.jsx`, `view-settings-agents.jsx`)

| Component | Role | Variants / states |
|-----------|------|-------------------|
| `PopoverShell` | Menu-bar popover wrapper, 380×680, with menubar icon + SVG tail | width / height / tailX, theme-aware |
| `WindowShell` | Full-window shell with traffic-light header (12px circles `#ff5f57`/`#febc2e`/`#28c840`), logo tile, title + subtitle | optional toolbar slot |
| `SettingsShell` | Two-column layout `210px 1fr` over `WindowShell` with left `SETTINGS_NAV` + page header + scroll body | active nav item, headerRight slot |
| `PopoverHeader` | Avatar roster + workspace name + live dot + settings IconBtn | connected vs offline (red dot) |
| `PopoverFooter` | Left/right slot footer | — |
| `TabStrip` | Persistent Inbox/In-progress/History tabs with count badges | active / inactive / urgent count |
| `SectionHeader` | Uppercase tracking label with right slot | top / accent |
| `IconBtn` | 30×30 ghost square | default / hover / active |
| `Btn` | Primary button primitive | **variants:** primary (coral) / secondary / ghost / danger / success / successSoft / warning; **sizes:** sm 26h / md 30h / lg 36h; `full`, optional `icon` |
| `Kbd` | Inline keyboard hint | — |
| `StatusDot`, `StatusBadge` | Reads `STATUS_CONFIG` (`popover-chrome.jsx:18-31`) keyed by status name | `mini`, `pulse`, custom label |
| `LiveDot`, `LiveLabel` | Pulsing green dot + "live"/"streaming" | size, label |

#### Domain primitives

| Component | Notes |
|-----------|-------|
| `Avatar` family (`avatar.jsx`) | Sizes xs/sm/md/lg/xl (22/28/36/48/72). HSL hue per agent, initials + photo (Dicebear), corner status dot with `working` pulse, `onboarding` spin, `off` hollow-slash. **No onError fallback today — unify with `DicebearImg`'s pattern from Avatar Workshop.** |
| `AvatarStack`, `AvatarRoster`, `PersonLine` | Overlap stack with +N overflow chip |
| `RobinGlyph` | Monoline "R", configurable size/colour |
| `RepoChip`, `BranchTag`, `PriorityDot` | Mono-font pills with sm/md variants |
| `BrainChip` | Model pill coloured by family (Opus → accent, Haiku → info, Sonnet → success) |
| `ChatComposer` (`chat.jsx`) | Auto-growing textarea up to 120px, attach/settings/mic toolbar, pill Send. `agentColor` recolours Send when chatting with one agent. |
| `ChatBubble` | Three roles: `user` (ink, right), `robin` (accentSoft + glyph), `agent` (panel + avatar). Asymmetric corners. |
| `ChatTab` | Pane sub-tabs with accent underline |

#### One-off / page-scoped cards & rows

`InboxCard` + `KindTag` + `PRChip` + `CopyBtn` (Inbox) · `WipCard` (Sprint) · `TimelineEntry` + `EventIcon` (Task detail — 8 event-type glyphs) · `HistoryRow` + `Filter` (Activity) · `SuggestionRow` + `RepoSelector` (Robin chat) · `SettingsCard` + `TagPill` + `RowKV` + `RowChips` + `SpendBar` (Settings drawer) · `ProfileCard` (Settings · Team) · `SubscriptionCard` + `ProviderLogo` (Settings · Brains) · `RepoRow` + `EnvironmentCard` + `Toggle` (Settings · GitHub) · `CapabilityCard` + `FeaturedCard` + `Stars` + `OfficialBadge` + `CapabilityIcon` (Capabilities) · `TeamRail` + `AgentChatPanel` + `LeaderboardRail` + `PodiumSlot` + `Achievement` + `Milestone` (Expanded).

**Dedupe candidates:** `SearchInput` (`view-settings-github.jsx`) and `SearchBox` (`view-capabilities.jsx`) are near-identical — collapse to one. `RobinGlyph + accent gradient` is repeated in 4 files (`Robin Desktop Client.html`, `view-new-task.jsx:17`, `view-expanded.jsx:481`, `chat.jsx:118`) — promote to `RobinLogoTile`.

**DS-level (extract to `packages/desktop-ui` later):** Avatar family, Btn, IconBtn, Kbd, StatusBadge, StatusDot, LiveDot, LiveLabel, TabStrip, RepoChip, BranchTag, PriorityDot, BrainChip, Toggle, ChatComposer, ChatBubble, RobinGlyph, SearchInput.

### 1.3 Navigation map

**Default entry on launch:** Inbox popover (`view-inbox.jsx` is labelled `01 · Inbox (default)`).

**Two-mode app, confirmed by the design.** The menu-bar popover (380×680, `PopoverShell` with tail to menu bar) and the expanded window (1100×680, `WindowShell` with traffic lights) coexist. Handoffs are explicit:
- `view-task-detail.jsx` footer: "To talk to {agent}, open the expanded view." → **Open chat ↗**
- `view-settings-panel.jsx`: **Open settings ↗** on every settings card.

**Persistent nav** differs by mode:

- **Popover:** no left sidebar. Persistent `PopoverHeader` (avatar roster · workspace name · live status · settings IconBtn) and `TabStrip` (Inbox / In progress / History) appear on the three default views. Task detail (03) and Robin chat (04) are intent-reached overlays with their own minimal headers (back arrow). Settings drawer (06) is reached via the header's settings IconBtn.
- **Expanded window:**
  - Home view (`view-expanded.jsx`) — 3-column with `TeamRail` as the persistent "who" selector.
  - All Settings subpages — `SettingsShell` with left `SETTINGS_NAV` (210px) containing: General / Team / Brains / Capabilities / GitHub / Infrastructure / Workspace / Billing / Danger zone. **Only Team / Brains / Capabilities / GitHub have implemented views; the other five are nav-stubs.**

**Modal vs popover dropdown:** no modal component is defined. The only true dropdown is `RepoSelector` in `view-new-task.jsx`. Destructive-action confirmations and toasts are not designed — must be added during build.

**Settings sub-navigation inconsistency:** `Capabilities` appears in `SETTINGS_NAV` but `view-capabilities.jsx` is a top-level `WindowShell` (not inside `SettingsShell`). Resolve before milestone work — recommendation in §3.

### 1.4 Branding tokens (from `theme.jsx` + inline overrides)

**Surfaces (light, canonical) — warm bone, never stark white:**
- `bg #f4f1e9` / `popover #fcfaf5` / `popoverEdge #ffffff` (top highlight) / `panel #f3efe5` / `hover #ece7d8` / `inset #ebe6d6`.
- Borders: `divider #e6e0cd` / `border #d8d1ba` / `borderStrong #c5bda1`. Shadows: `rgba(85,65,30,0.10)` / `rgba(60,40,10,0.20)`.

**Text:** `ink #1a1612` / `ink2 #4d463c` / `ink3 #7a7263` / `ink4 #a59c89` (placeholder) / `monoColor #5a5346`.

**Accent (Robin coral):** `accent #d63916` / `accentHover #bd2f10` / `accentInk #fff7f3` / `accentSoft #fbe2d6` / `accentBorder #f0b699`. Gradient: `linear-gradient(135deg, #ff7e58, #d63916)` for the Robin logo tile.

**Status colours (each has `*Soft` ~10% and `*Border` ~25%):** `success #15803d` · `warning #a16207` (amber-700, "blocked / needs you") · `danger #b91c1c` · `info #6d28d9` (violet, "review / PR") · `neutral #7a7263`.

**Dark theme** has the same keys, `accent` shifts to `#ff7d4d` for AA contrast. Toggle is manual via `tweaks-panel.jsx` (design tool only — strip from product).

**Per-agent hue** is a critical concept: each `MOCK_AGENTS` entry has a hue (HSL angle, 6 distinct). Used for Avatar gradient (`hsl(hue, 62%, 56%) → hsl(hue+22, 70%, 46%)`), History lane line, agent specialty pills, and the Send button on a specific agent's chat composer. Backend must add `agents.hue smallint` (or derive deterministically from `agent.id`).

**Typography:**
- Sans: **Geist** (400/500/600/700), loaded from Google Fonts.
- Mono: **Geist Mono** (400/500/600) — SHAs, branch refs, repo names, API keys, scores.
- Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui`.
- **No formal scale today** — sizes range 8.5–22px hard-coded per view. Plan must impose a scale (proposed: `10 / 11 / 12 / 13 / 14 / 16 / 18 / 22`).
- Line heights `1.2` (headings) / `1.35–1.45` (body) / `1.5–1.55` (chat).

**Spacing / radii:** ad-hoc (2/4/6/7/8/10/12/14/16/18/20/22/24/28/32). Radii cluster at `4` (Kbd, branch) / `6–8` (chips, sm buttons) / `10–12` (cards) / `14` (profile, bubble) / `16` (PopoverShell, ChatComposer) / `999` (pills). Multi-stop shadows on shells.

**Iconography:** **all inline SVGs, no Lucide.** ~50 ad-hoc paths. `view-capabilities.jsx` has a 12-icon library; event types in `view-task-detail.jsx` have bespoke glyphs; achievements in `view-expanded.jsx` likewise. Port recommendation: keep the bespoke event/achievement glyphs (they're brand), swap incidental UI icons for **Lucide** (already a dependency on web).

**Motion:** `robinPulse` (1.8–2s — LiveDot, working ring, status pulse), `spin` (1.2s — onboarding ring), `robinFloat` (4s breathing — Avatar Workshop), inline transitions (0.12s bg, 0.15s border), `Btn` press `translateY(0.5px)`. No spring physics, no framer-motion. CSS-only keeps Tauri/WebKit happy.

### 1.5 macOS-native affordances — design signal vs open

| Surface | Design signal | Status |
|---------|--------------|--------|
| Menu bar / tray | **Explicit.** `PopoverShell` draws the menubar icon + SVG tail at the top — canonical macOS menu-bar app pattern. | Build |
| Traffic-light window chrome | **Explicit.** `WindowShell` draws `#ff5f57`/`#febc2e`/`#28c840`. (Note: in Tauri we use the OS-native title bar, not painted circles.) | Build with native chrome |
| Two-mode app | **Explicit.** Popover ↔ expanded window handoffs. | Build |
| Live updates | **Pervasive.** `LiveDot`/`LiveLabel` on every list view, working-pulse on Avatars. | Build (Supabase Realtime) |
| Disconnected state | **Designed in `_v1-dark` only.** Not ported to light/v3. `PopoverHeader` supports a `connected={false}` red dot. | Port from `_v1-dark` |
| Keyboard shortcuts | Only `Kbd "@"` in Robin chat. No global hotkey hinted. | **Open question** |
| Notifications | Settings card shows "Email not set · Slack webhook not set" but no native banner/sound/DND. Inbox semantics imply unread/read. | **Open question** + design native |
| Deep links | `↗` callouts to web/GitHub. No `robin://` implied. | **Open question** — recommend `robin://` for inter-app + auth callback |
| Drag & drop | None implied. | **Open question** |
| Multi-window | Single expanded + popover. Settings subpages replace expanded content. | Single-window-plus-popover |
| System theme | Manual light/dark toggle only (`tweaks-panel`). No "follow system". | **Open question** — recommend system follow |
| Login / first-run | **Missing.** Legacy v1-dark references Clerk + Supabase. No signed-out, no onboarding, no empty state. | **Design gap** |
| Empty / error / loading states | None designed for any list. `robinShimmer` keyframe defined but unused. | **Design gap** — must improvise |
| Window resize / min size | All artboards fixed (380×680, 1100×680). | **Open question** |
| Streaming chat reply | No design for mid-stream agent response. | **Open question** |

### 1.6 Mock data shape (`data.jsx`)

`MOCK_WORKSPACE`, `MOCK_AGENTS` (6, with `hue` / `specialty[]` / `workstation` / `brain` / `repos[]` / `avatar_config` / `current_task_id`), `MOCK_TASKS` (3 in-progress, with `current_activity` / `progress` / `started`), `MOCK_INBOX` (6 cards), `MOCK_HISTORY` (10 commits), `MOCK_LEADERBOARD` (per-agent commits/PRs/lines/score), `MOCK_CAPABILITIES` (12 packs), `TASK_111_TIMELINE`, `ROBIN_CHAT`, `ARIA_CHAT`, `SUBSCRIPTIONS`, `BRAINS`, `GH_REPOS`. Helpers: `getAgent(id)`, `getTask(id)`.

Fields **new** to the desktop concept (not in current web data model):
- `agents.hue` (HSL angle, drives every per-agent colour cue).
- `agents.specialty[]` (text array for specialty pills).
- `agents.workstation` (label, specs, location, provider, cpu, ram) — partially exists as `vps_*` columns but not surfaced.
- `agents.bio` (first-person narrative).
- `agents.onboarded` (date).
- Inbox cards as **summarised "letters"** (`headline` + first-person `body` + outcome metadata) — projection, not a raw row.
- Leaderboard / XP / score — no web counterpart.
- Capabilities marketplace metadata (`installs`, `rating`, `installed_by`, `official`, `popular`) — `capability_definitions` lacks these.
- `SUBSCRIPTIONS` with monthly caps + spend tracking — no web counterpart.

---

## Phase 2 — Web feature mapping

Web reference: `apps/web/` (Next.js 15 App Router, React 19, Tailwind 3.4, Clerk + Supabase). Route Handlers funnel through `apps/web/lib/api/requireWorkspace.ts`. Realtime hooks live in `apps/web/lib/realtime/*.ts`. Background work enqueues directly to BullMQ singletons in `apps/web/lib/queue/*.ts` — **never embed these on desktop**.

### 2.1 Design feature → backend surface → portability

| Design feature | Web route(s) / files | API surface | DB tables / RLS | Realtime channels | Auth | Portability |
|----------------|---------------------|-------------|------------------|--------------------|------|-------------|
| **Inbox (01)** — letters with outcome, body, PR, tokens | None (closest is `/dashboard` feed) | None today; needs **new** `GET /api/inbox` projection over `task_events` per workspace | `task_events` (append-only, RLS user-scoped via workspace_id) | `task-events-feed-<wid>` (`useDashboardFeed`) | Clerk + Supabase JWT template | **Rework.** Letter projection (headline + first-person body) is brand-new and likely needs a small AI summariser. Storage: optional `inbox_items` table or materialised view. |
| **In progress (02)** — live WIP task cards | None directly; data lives in dashboard | None today; reuse `GET /api/tasks?status=in_progress` (filter exists) | `tasks` (RLS user-scoped) | `tasks UPDATE filter sprint_id=eq.<sid>` (`useActiveTask`) | Same | **Carries over.** Adds Supabase subscription on `tasks` by `workspace_id`. |
| **Task detail (03)** — ADWP timeline | `/tasks/[taskId]` (`TaskDetailClient.tsx`) | `GET /api/tasks/[taskId]`, `GET /api/tasks/[taskId]/events` (≤500), `POST /api/tasks/[taskId]/events` (human.commented/approved/rejected) | `tasks`, `task_events`, `task_iterations`, `task_artifacts` | `task-events-feed-<taskId>` (`useTaskEventsFeed`) | Same | **Carries over.** Reuse `projectTaskState()` projector from `apps/web/lib/db/projectTaskState.ts` verbatim. |
| **Robin chat (04)** — natural-language task assignment | None — `BrainstormModal` exists but is **AI Brainstorm**, a different feature (`POST /api/ai/brainstorm` streams Anthropic via SSE) | None today | n/a | n/a | n/a | **New.** Needs an orchestrator endpoint that parses intent + assigns the right agent + creates a task. Likely uses `claude-sonnet-4-6` via `POST /api/orchestrator/route` and ends in a normal task creation. **Defer to v2.** |
| **History (05)** — agent-coloured git log | None | Either query `task_events` for `agent.commit.pushed` events, or new `GET /api/history` aggregating per workspace | `task_events` (`agent.commit.pushed`, `agent.pr.opened`) | `task-events-feed-<wid>` | Same | **Carries over** (data exists in events). Lane colouring uses `agents.hue` (new field). |
| **Settings drawer (06)** | `/settings` (one big page) | Various GET endpoints + read-only Server Component fetches | Many | None | Same | **Carries over** for the read-only snapshot. Each card defers actual editing to its expanded subpage. |
| **Expanded — per-agent chat (Exp)** | `/tasks/[taskId]` is the closest, but timeline-only | `POST /api/tasks/[taskId]/events { type: 'human.commented' }` is the existing message-to-agent channel; **no live "chat with the Claude Code instance"** | `task_events`, `tasks` | `task-events-feed-<taskId>` | Same | **Partial.** The design's "chat with this engineer" is best interpreted as "chat thread on the agent's *current task*" — wire it to `human.commented` events on the agent's `current_task_id`. Mid-stream agent reply: not currently surfaced. |
| **Expanded — TeamRail** | `/agents` (`AgentsClient.tsx`) | None (server-component reads view) | `agents_with_status` view (joins `agents` + `agent_status`, derives `effective_status` from `last_seen_at`) | `agents *`, `agent_status *` filter `workspace_id` | Same | **Carries over.** Subscribe to `agents` + `agent_status` like `AgentStatusGrid`. |
| **Expanded — LeaderboardRail** | None | None today; needs new aggregation | New table or view over `task_events` (`agent.commit.pushed`, `agent.pr.opened`, `task.completed`) | n/a | Same | **New.** XP / score / podium has no backend. **Defer to v2.** |
| **Settings · Team (07)** | `/agents`, `/agents/[agentId]` | `POST /api/agents`, `DELETE /api/agents/[agentId]`, `POST /api/agents/[agentId]/retry-provisioning` | `agents`, `agent_repositories`, `agent_status` | `agents *` per workspace | Same | **Carries over** for read + provisioning trigger. **Edit profile / hire flow / bio editing** is new — defer the inline edit to v2. |
| **Settings · Brains (08a)** | `/settings` has placeholder "Agents defaults" (mostly disabled inputs) | None | n/a | n/a | n/a | **Defer to v2.** Subscriptions table, per-agent overrides, monthly caps, auto-switch rule — all new schema. |
| **Avatar Workshop (08b)** | `agents.avatar_url` exists; `avatar_config` not yet surfaced as editable | None | `agents` (existing `avatar_url`; add `avatar_config jsonb` if not present) | n/a | Same | **Defer to v2.** Dicebear editor is brand-new UI; backend trivially extended. |
| **Capabilities (10)** | `/maintenance` (close but different) | `/api/maintenance/configs` lists `workspace_capability_configs`; no marketplace fields | `capability_definitions`, `workspace_capability_configs`, `agent_runs`, `spec_findings`, `bug_findings` | None | Same | **Defer to v2.** Marketplace UX requires new metadata (rating, official, installed_by, popular, tags, installs). |
| **Settings · GitHub (11)** | `/settings` (GitHub card + Repository list + Environments) | `GET/DELETE /api/auth/github`, `GET /api/auth/github/callback`, `POST /api/auth/github/detect`, `GET /api/github/repos`, `POST /api/github/repos/enable`, `DELETE /api/github/repos/[repoId]`, `GET/POST /api/environments`, `PATCH/DELETE /api/environments/[id]`, `PUT /api/environments/[id]/env-vars` | `github_connections`, `repositories`, `workspace_environments` | None | Same | **Carries over fully.** Every endpoint exists. Connect-GitHub callback (`/api/auth/github/callback`) opens system browser; desktop catches the post-callback success state by re-fetching `/api/github/repos`. |
| **Disconnected state** | None on web (always assumes connection) | n/a | n/a | n/a | n/a | **New** for desktop. Detect via Supabase Realtime channel state + last `setAuth` token expiry; fall back to last-known cached snapshot. |
| **Native notifications** | None on web | n/a | n/a | n/a | n/a | **New.** Wire to Realtime `task_events` filtered by workspace, fire local macOS notifications on `agent.blocked`, `task.completed`, `task.failed`, `agent.pr.opened`. |

### 2.2 Backend surface ready vs needs-extension

**Ready as-is (no backend change required for v1):**
- All task CRUD (`/api/tasks`, `/api/tasks/[id]`, `/api/tasks/[id]/events`).
- All sprint CRUD + sprint start (`/api/sprints/*`).
- All agent provisioning + dispose (`/api/agents/*`).
- All GitHub connection + repo + environment (`/api/auth/github/*`, `/api/github/repos/*`, `/api/environments/*`).
- Maintenance read (`/api/maintenance/inbox`, `/api/maintenance/metrics`).
- `agents_with_status` view for the TeamRail.
- All Realtime channels: `task_events`, `tasks`, `agents`, `agent_status`, `ops_runs`.

**Needs new backend for v1:**
- `agents.hue smallint NOT NULL DEFAULT (mod(hashtext(id::text), 360))` (migration) — drives all per-agent colour cues. Hue source-of-truth must live in DB.
- **Inbox projection** — either materialise letter-shaped rows from completed/failed tasks, or assemble client-side from `task_events` + a small AI summariser endpoint. **Recommendation: client-side assembly in v1 (no backend change), AI summarisation deferred.**

**Needs new backend (v2):**
- Robin orchestrator chat (`view-new-task`).
- Brains / Subscriptions / per-agent model override + auto-switch rule.
- Capabilities marketplace metadata.
- Leaderboard / XP aggregation.
- Profile editing (bio, specialty, workstation labels), hire flow.

### 2.3 Auth surface — the only structural lift

Web auth is **Clerk session cookie + Clerk-templated `supabase` JWT** (template name confirmed in `apps/web/lib/supabase/server.ts` and every Realtime hook). The desktop client cannot replay browser cookies and cannot embed Clerk's JS SDK in a webview without auth UI duplication.

**Existing token surfaces:**
1. **Clerk cookie + middleware** (`apps/web/middleware.ts`) — protects every route except `/`, `/sign-in*`, `/sign-up*`, `/api/webhooks/*`, `/api/connector/*`, `/api/auth/session`.
2. **KVA SSO** (`apps/web/lib/auth/sso.ts`, `apps/web/app/api/auth/session/route.ts`) — `X-KVA-Token` HS256 JWT signed with `KVA_SSO_SECRET`. **Explicitly not the gestionale auth path** (`docs/desktop-client-api-map.md:16`). Service-to-service.

The desktop port must end up holding a **Clerk-templated `supabase` JWT** to hit the same Realtime channels and RLS-scoped REST. Two paths exist — see §3.3.

---

## Phase 3 — Architecture decisions

Each decision lists the recommendation, the rejected alternative, and the trade-off.

### 3.1 Shell technology — **Tauri v2** (rejected: Electron)

**Recommendation: Tauri v2** (Rust core + macOS WebKit WebView).

**Rationale:**
- Bundle size matters for a "downloadable" first impression — Tauri ships ~5–15 MB DMGs vs Electron's ~80–150 MB.
- The web UI is plain React + Tailwind + Lucide with **no Radix portals, no cmdk, no service workers** (audit confirmed) — WebKit-only quirks are unlikely.
- Tauri v2 has first-class macOS plugins for menu bar / tray icon (`tauri-plugin-positioner` + tray APIs), notifications (`tauri-plugin-notification`), deep links (`tauri-plugin-deep-link` for `robin://`), single-instance (`tauri-plugin-single-instance`), updater (`tauri-plugin-updater` with cryptographic signature verification), Keychain via `tauri-plugin-keyring` or `tauri-plugin-stronghold`.
- Rust side gives a clean place to put the Supabase JWT exchange + Keychain storage outside the JS context, reducing the secret's exposure surface.
- Auto-updater works with a signed JSON manifest hosted on S3/R2/Vercel.

**Rejected: Electron.** Trade-off: Electron buys nothing the design needs (no Node native modules required — BullMQ, Prisma, Anthropic SDK all stay server-side). Costs ~10× the bundle, ~2× the memory footprint, and we'd still need to add macOS-native plumbing via separate libraries. The argument for Electron — "Chromium parity with the web app" — is weakened by the fact that the desktop UI is a **fresh build**, not an embed of the web app.

**Also rejected: native Swift / SwiftUI.** Trade-off: SwiftUI's `MenuBarExtra` API is best-in-class and matches the design exactly. But it throws away every React component, doubles the codebase (web + desktop don't share UI primitives at all), and means every brand iteration ships twice. The design's React origin makes Tauri the better fit. Revisit native Swift if we ever ship Windows/Linux (we won't).

### 3.2 Frontend stack — **Vite + React + TanStack Router** (rejected: Next.js `next export`, rejected: wrap remote URL)

**Recommendation: a fresh Vite + React + TanStack Router (or React Router) SPA** inside `apps/desktop/`, with shared types from `packages/shared-types` and **gradual extraction** of reusable primitives to a new `packages/desktop-ui` package as we identify them.

**Rationale:**
- `apps/web/` pages are predominantly **Server Components** that call `lib/db/*` which calls `apps/web/lib/supabase/server.ts` which depends on Clerk's server `auth()` helper. These cannot run in a desktop bundle without a structural rewrite.
- The state model is the simplifying factor: **no Zustand, no React Query, no SWR, no Jotai** (audit confirmed). State is `useState` + Supabase Realtime + `router.refresh()`. That pattern moves cleanly to a Vite SPA with TanStack Query (which we'd add for caching) or even raw Supabase fetch.
- Tailwind 3.4 + Lucide React + the few hand-rolled shadcn primitives (`Button`, `Input`, `Textarea`, `Tooltip`, `AppDialog`, `FormField`, `CustomSelect`) carry over file-by-file.
- TanStack Router gives type-safe routing without the dev-server complexity of Next.js, which we don't need in a desktop bundle.

**Rejected: Next.js with `next export` / static export.** Trade-off: would let us reuse some pages 1:1, but every interesting page is a Server Component fetching via Supabase server client. The conversion to client components (re-fetching client-side with the JWT) is structurally equivalent to writing fresh Vite pages, and we'd carry Next.js framework weight (build tooling, route file system, font loader) for no upside on a desktop bundle.

**Rejected: Tauri wraps `https://app.robin.dev` as a remote URL.** Trade-off: zero porting work. But (a) Clerk authentication into a webview from native is awkward — Clerk's session cookie has to survive the embedded webview, which isn't shielded the same way as the system browser; (b) offline mode is dead by definition; (c) deep-link handling between menu-bar popover (different URL?) and main window is fragile; (d) we lose the ability to use Rust for secure storage / Keychain; (e) we'd ship Vercel's TLS dependency in the menu bar — any web outage takes down the desktop client.

**Component sharing strategy:** start by *copying* primitives from `apps/web/components/` into `apps/desktop/src/components/` for v1. Once we ship and see what actually overlaps, extract the truly-shared ones to `packages/desktop-ui` (or a more generally-named `packages/ui`) and have **both** apps depend on it. Premature extraction will balloon the design-system surface before we know what's worth sharing.

### 3.3 Auth strategy — **System-browser OAuth (Clerk native flow) + `robin://` callback + Keychain** (rejected: device tokens, rejected: embedded Clerk JS)

**Recommendation:** the desktop client launches the system browser to a Clerk-hosted sign-in URL with a PKCE challenge, captures the redirect to `robin://auth/callback?code=...`, exchanges the code via a new **`POST /api/auth/desktop-session`** endpoint that returns a Clerk session token + a Clerk-templated `supabase` JWT. The session token is persisted in macOS Keychain via Tauri's keyring plugin. Refresh happens on app launch + every ~50 minutes (Clerk JWTs expire at 60 min).

**Server-side additions required:**
- A new public route `/api/auth/desktop-session` (added to middleware public-route matcher) that:
  1. Verifies PKCE.
  2. Resolves the Clerk session.
  3. Mints both a long-lived refresh token (or stores a session reference) and a short-lived `supabase` JWT via Clerk's `getToken({ template: 'supabase' })`.
  4. Returns both to the desktop client.
- A `/api/auth/desktop-session/refresh` for the short-lived JWT roll.
- Optional: a "remote sign-out" surface (`/settings` shows desktop devices and can revoke them).

The desktop client then uses the `supabase` JWT exactly as the web does — `supabase.realtime.setAuth(token)` before subscribing, `Authorization: Bearer <jwt>` on REST calls. **Same RLS posture as the web client.**

**Rationale:**
- Best UX: user clicks "Sign in", system browser opens with the familiar Clerk page, then returns to the app. Same shape as 1Password, Linear, Figma, etc.
- Reuses Clerk's identity model — no second source of truth.
- Refresh token in Keychain is platform-standard.

**Rejected: device tokens** (user generates a token at `/settings/desktop`, pastes into the app). Trade-off: cheaper to ship (no OAuth dance), but worse UX, no automatic revocation on password change, no MFA enforcement, and we'd still need a "list devices" UI eventually. Worse first impression for a downloadable product.

**Rejected: embed `@clerk/clerk-js` in the WebView.** Trade-off: theoretical fastest path. But Clerk's session cookie semantics inside an embedded WebView are not the same as in a system browser — risk of session loss on app restart, no shared SSO with browser sessions, harder to debug. Also offers no Keychain story by itself.

**Rejected: mirror the KVA SSO path** (`X-KVA-Token` style). Trade-off: this is explicitly **not** the gestionale auth path per `docs/desktop-client-api-map.md:16`. Using it would mean the desktop talks to a different identity store than the web app — a guaranteed source of confusion and a security debt.

### 3.4 State sync — **Supabase Realtime as-is + cached last-snapshot in `tauri-plugin-store`, no SQLite v1** (rejected: SQLite cache, rejected: pure online)

**Recommendation:** every list view subscribes to Supabase Realtime the same way the web app does. On disconnect, the UI shows the disconnected state (ported from `_v1-dark/view-disconnected.jsx`) over the last-rendered data, which is persisted to `tauri-plugin-store` (per-view JSON snapshots) so the app reopens with content even before the first Realtime tick.

**Rationale:**
- The design's "live" emphasis is fundamental — desktop without a live channel is a degraded UX, not the default UX.
- SQLite (via `tauri-plugin-sql`) is the right v2 answer for a true offline mode (browse history without connection, queue writes for later sync). But v1 doesn't need it: every action requires a live backend (enqueue, GitHub, agent).
- `tauri-plugin-store` (encrypted file-backed KV) covers "remember the last-seen inbox and sprint" without schema/migration burden.

**Rejected: SQLite cache layer in v1.** Trade-off: would enable offline browsing and is the "right" long-term answer. Cost: schema design, sync strategy, migration tooling, conflict resolution semantics. Not worth it for v1 when every action is online-only.

**Rejected: pure online, no cache.** Trade-off: simplest. But the app would launch with a blank screen for ~500ms on every open, which is a noticeable UX regression vs. a native macOS app.

### 3.5 Updates & distribution — **Tauri updater + GitHub Actions code-signing + R2 / Vercel-hosted manifest** (rejected: ad-hoc download page only)

**Recommendation:**
- **Codesign + notarize** in CI (GitHub Actions) using a Developer ID Application certificate + Apple notarytool.
- **Tauri v2 updater plugin** with a signed JSON manifest (Tauri's own signature, not just Apple's) hosted at `https://downloads.robin.dev/desktop/manifest.json` (R2 or Vercel — either works; R2 is cheaper at scale).
- **Versioning:** `apps/desktop/package.json` version drives both the `.dmg` filename and the manifest. Tag releases as `desktop-vX.Y.Z` (separate from web releases to allow independent cadence).
- **Download page:** new route `apps/web/app/(marketing)/desktop/page.tsx` with a single CTA to the current `.dmg` and platform-detected copy.
- **Update channel:** start with `stable` only. Add `beta` channel later if needed (manifest has a `channels` field).

**Rejected: ad-hoc download page, no auto-updater.** Trade-off: faster to ship v1 by 1–2 days. But users will end up running stale versions forever, and we'd have to ship breaking changes very carefully. Auto-update is the difference between "released" and "shipped".

### 3.6 Monorepo placement — **`apps/desktop/`** (already exists, currently holds only `design/`)

**Recommendation:**
```
apps/desktop/
  design/                ← already there, keep as reference
  src/                   ← Vite renderer (React + TS + Tailwind)
    components/
    routes/
    lib/
      auth/              ← Clerk session, Keychain
      supabase/          ← client + JWT propagation
      realtime/          ← hooks (mirror apps/web/lib/realtime/*)
      api/               ← typed REST wrappers
  src-tauri/             ← Rust shell
    src/
      main.rs            ← tray icon, popover window, deep-link handler
      auth.rs            ← system-browser OAuth, Keychain
      updater.rs
    tauri.conf.json
    icons/
  package.json
  vite.config.ts
  tsconfig.json
```

**Workspace deps:** `@robin/shared-types` (existing) for typed payloads; lucide-react, tailwind, react, react-dom, supabase-js, tauri APIs. **No Clerk SDK** in the renderer (PKCE flow happens in Rust + a thin TS shim). **No BullMQ, no Prisma, no Anthropic SDK** anywhere.

**`packages/shared-types`** stays untouched. Add a small `packages/desktop-ui` only after milestone 5 once we've identified true shared primitives — premature extraction hurts.

**Build matrix:**
- `pnpm --filter @robin/desktop dev` — Vite dev server + `tauri dev`.
- `pnpm --filter @robin/desktop build` — Vite build → `tauri build` produces signed/notarized `.dmg`.
- CI: GitHub Actions matrix builds + signs on macOS runner, uploads to R2, publishes manifest.

---

## Phase 4 — Milestone breakdown

Effort scale: **S** ≈ 1–2 days · **M** ≈ 3–6 days · **L** ≈ 7–14 days. All sizes assume one focused engineer; treat as planning estimates not commitments.

### M0 — Scaffolding (S)

**Goal:** Tauri v2 + Vite + React + Tailwind + TS shell builds and runs an empty signed window locally.

**Files / dirs touched:**
- `apps/desktop/{src,src-tauri,package.json,vite.config.ts,tsconfig.json,tailwind.config.ts,postcss.config.mjs}`
- `apps/desktop/src-tauri/{Cargo.toml,tauri.conf.json,src/main.rs}`
- Root `pnpm-workspace.yaml` updated to include `apps/desktop`.
- `package.json` (root) — add `desktop:dev`, `desktop:build` scripts.

**Acceptance:**
- `pnpm install` from root works.
- `pnpm --filter @robin/desktop dev` opens a blank Tauri window with the Geist font loaded.
- `pnpm --filter @robin/desktop build` produces an `.app` bundle on macOS.
- Lints + TS strict pass.

**Dependencies:** none.

### M1 — Auth + Supabase client (M)

**Goal:** the desktop signs the user in via system-browser OAuth, stores the session in Keychain, mints + refreshes the `supabase` JWT, and the renderer can subscribe to Supabase Realtime as the authenticated user.

**Files / dirs touched:**
- `apps/desktop/src-tauri/src/auth.rs` — PKCE flow + Keychain (via `tauri-plugin-keyring` or `keyring` crate).
- `apps/desktop/src-tauri/src/main.rs` — register `robin://` URL scheme via `tauri-plugin-deep-link`.
- `apps/desktop/src/lib/auth/{session.ts,refresh.ts}` — TS shim invoking Rust commands.
- `apps/desktop/src/lib/supabase/{client.ts,realtime.ts}` — mirror `apps/web/lib/supabase/client.ts` pattern but get JWT from Keychain instead of Clerk SDK.
- `apps/desktop/src/routes/sign-in.tsx`, `apps/desktop/src/routes/__root.tsx` — TanStack Router.
- **`apps/web/app/api/auth/desktop-session/route.ts`** — new public endpoint, PKCE + token exchange.
- **`apps/web/app/api/auth/desktop-session/refresh/route.ts`** — refresh endpoint.
- `apps/web/middleware.ts` — add the two new routes to the public matcher.
- `apps/web/lib/auth/desktop-session.ts` — server helper (PKCE verifier table or stateless JWT).

**Acceptance:**
- First launch shows sign-in screen.
- Clicking "Sign in" opens default browser at Clerk sign-in.
- After completing sign-in, browser hands back to `robin://auth/callback`, app captures it.
- App restarts retain the session.
- Supabase Realtime channel subscribes successfully (verify with a smoke `task_events` listen).
- Sign-out clears Keychain and routes back to sign-in.
- `requireWorkspace()` continues to work for browser users (no regression on web).

**Dependencies:** M0.

### M2 — Design tokens + DS primitives (M)

**Goal:** the design's tokens are codified, fonts loaded, and a stable set of primitives (Btn, IconBtn, Avatar, Kbd, StatusBadge, LiveDot/LiveLabel, TabStrip, RepoChip, BranchTag, BrainChip, PriorityDot, Toggle, ChatBubble, ChatComposer, RobinGlyph, RobinLogoTile) render with visual parity to the design canvas.

**Files / dirs touched:**
- `apps/desktop/src/styles/{theme.css,fonts.css,globals.css}` — CSS custom properties for every token in `theme.jsx`, light + dark, scoped to `:root[data-theme="light|dark"]`.
- `apps/desktop/tailwind.config.ts` — extend with the surfaces / ink / accent / status palettes referencing the CSS vars.
- `apps/desktop/src/components/primitives/{Avatar.tsx,Btn.tsx,IconBtn.tsx,Kbd.tsx,StatusBadge.tsx,LiveDot.tsx,TabStrip.tsx,RepoChip.tsx,BranchTag.tsx,BrainChip.tsx,PriorityDot.tsx,Toggle.tsx,ChatBubble.tsx,ChatComposer.tsx,RobinGlyph.tsx,RobinLogoTile.tsx}`.
- `apps/desktop/src/routes/_internal/stories.tsx` — internal-only route rendering each primitive in every variant (so we can compare to the design canvas side by side).
- Impose a formal type scale `10/11/12/13/14/16/18/22` and update primitives to use it; ad-hoc design values are *not* ported 1:1.
- Avatar: unify the photo fallback (graceful gradient + initials on `onError`, mirroring `DicebearImg` from Avatar Workshop).

**Acceptance:**
- `_internal/stories` page side-by-side matches the design canvas at zoom 1×.
- Light/dark theme toggle works (manual; system follow deferred to M-OQ).
- Tailwind config exposes every status colour as utility class (e.g. `bg-success-soft`).
- All primitives are accessible (keyboard focus visible, semantic HTML).

**Dependencies:** M0.

### M3 — Popover shell + tray (M)

**Goal:** clicking the macOS menu-bar icon toggles a popover window with the `PopoverShell` chrome + `PopoverHeader` + `TabStrip` rendering the three top-level tab routes (Inbox / In progress / History) as empty states. Single-instance behaviour. Quit / Sign-out / Preferences in the tray menu.

**Files / dirs touched:**
- `apps/desktop/src-tauri/src/{tray.rs,popover.rs}` — tray icon, positioner, popover window (frameless, transparent, 380×680).
- `apps/desktop/src-tauri/tauri.conf.json` — windows config, plugin allowlist.
- `apps/desktop/src/routes/popover/{__layout.tsx,inbox.tsx,in-progress.tsx,history.tsx}`.
- `apps/desktop/src/components/shell/{PopoverShell.tsx,PopoverHeader.tsx,PopoverFooter.tsx,TabStrip.tsx,SectionHeader.tsx}`.
- `apps/desktop/src/lib/menu-bar/{useToggle.ts}` — IPC to Rust toggle.

**Acceptance:**
- Tray icon appears on launch, persists across sessions.
- Clicking tray icon toggles popover open/closed.
- Popover anchors to the tray icon (positioner).
- Clicking outside the popover dismisses it.
- All three tab routes render with the popover chrome + empty-state placeholders.
- `Cmd+Q` quits cleanly; `Cmd+W` only closes the popover, not the expanded window (open question to confirm).

**Dependencies:** M0, M2.

### M4 — Inbox view (M)

**Goal:** the Inbox tab shows real letter-cards assembled from `task_events` for the workspace, live-updates when new events arrive, supports Copy + Mark all read + Open web deep-link.

**Files / dirs touched:**
- `apps/desktop/src/lib/realtime/useInboxFeed.ts` — port of `useDashboardFeed` filtered + grouped by `task_id`, projecting completed/failed/review-ready tasks into letter shape.
- `apps/desktop/src/lib/inbox/{projectLetter.ts,kindFor.ts}` — pure function turning a task + its event tail into `{kind, headline, body, repo, pr, error, duration, tokens, tags}`. **v1 produces a literal headline and a templated body**, not an AI summary.
- `apps/desktop/src/routes/popover/inbox.tsx`, `apps/desktop/src/components/inbox/{InboxCard.tsx,KindTag.tsx,PRChip.tsx,CopyBtn.tsx}`.
- `apps/desktop/src/lib/storage/inboxRead.ts` — `tauri-plugin-store` table of `{taskId → readAt}` for unread state.
- Deep-link helper to web (`https://app.robin.dev/tasks/<id>`).

**Acceptance:**
- Inbox shows up to N (e.g. 50) letter-cards sorted by most recent task event.
- Unread cards have the border + bg the design specifies; read cards are faded.
- Mark all read updates the local store; restart preserves it.
- Copy puts the headline + body on the clipboard.
- New events from Supabase Realtime flow into the list without a manual refresh.
- Failed tasks render the danger-styled error monoblock.

**Dependencies:** M1, M3.

### M5 — In-progress + History (M)

**Goal:** the In-progress tab shows live WIP cards with branch / repo / PR / priority and `current_activity`, expandable description. The History tab shows the per-day grouped commit log with agent-hue lanes and merge halos.

**Files / dirs touched:**
- `apps/desktop/src/lib/realtime/useInProgressTasks.ts` — subscribe to `tasks` filtered by `workspace_id` and `status in (queued, in_progress, in_review, review_pending)`.
- `apps/desktop/src/lib/realtime/useHistoryFeed.ts` — subscribe to `task_events` filtered by event type `agent.commit.pushed` and `agent.pr.opened`.
- `apps/desktop/src/components/wip/{WipCard.tsx,LiveLabel.tsx}`.
- `apps/desktop/src/components/history/{HistoryRow.tsx,Filter.tsx}`.
- `apps/desktop/src/routes/popover/{in-progress.tsx,history.tsx}`.
- **Backend migration:** `supabase/migrations/00XX_agents_hue.sql` — add `hue smallint NOT NULL DEFAULT (mod(abs(hashtext(id::text)), 360))`. Backfill existing agents with stable hues per `id`.

**Acceptance:**
- In-progress cards show all six agents' WIP tasks live.
- Expandable description toggles per card.
- History grouped Today / Yesterday / Earlier; merges have the success halo and larger dot.
- Filter (All / Merges / By engineer) is functional.
- Lane colour uses `agents.hue` from the new column.

**Dependencies:** M1, M3, M4.

### M6 — Task detail (S)

**Goal:** clicking a card transitions to the task detail timeline using `projectTaskState()` ported verbatim from `apps/web/lib/db/projectTaskState.ts`. Live updates via `useTaskEventsFeed`. **Open chat ↗** opens the expanded window with the agent pre-selected.

**Files / dirs touched:**
- `apps/desktop/src/lib/db/projectTaskState.ts` — copy from web (later promote to `packages/shared-types` or a new `packages/projections`).
- `apps/desktop/src/lib/events/narrativize.ts` — copy from `apps/web/lib/events/narrativize.ts`.
- `apps/desktop/src/lib/realtime/useTaskEventsFeed.ts` — copy from web.
- `apps/desktop/src/components/task-detail/{TimelineEntry.tsx,EventIcon.tsx}` — port bespoke event glyphs (keep them, don't replace with Lucide).
- `apps/desktop/src/routes/popover/task/$taskId.tsx`.
- `apps/desktop/src/lib/expanded/openForAgent.ts` — IPC to Rust to show + focus the expanded window with `?agentId=...`.

**Acceptance:**
- Timeline renders identical event types to web's `TaskDetailClient`.
- Real-time INSERT on `task_events` appends to the view without flicker.
- Open chat ↗ navigates to expanded window with correct agent selected.

**Dependencies:** M5.

### M7 — Expanded window shell + per-agent chat (L)

**Goal:** the expanded window opens at 1100×680 with native title bar, three-column layout. TeamRail lists agents from `agents_with_status` view, AgentChatPanel shows the chat thread (rendered from `human.commented` events on the agent's current task) + ChatComposer that sends `POST /api/tasks/[taskId]/events { type: 'human.commented' }`. LeaderboardRail is rendered as a v2-stub card ("Leaderboard coming soon").

**Files / dirs touched:**
- `apps/desktop/src-tauri/src/expanded.rs` — second window, native chrome.
- `apps/desktop/src-tauri/tauri.conf.json` — register expanded window.
- `apps/desktop/src/routes/expanded/__root.tsx`, `apps/desktop/src/routes/expanded/agents/$agentId.tsx`.
- `apps/desktop/src/components/expanded/{WindowShell.tsx,TeamRail.tsx,AgentChatPanel.tsx,LeaderboardRailStub.tsx,ChatTab.tsx}`.
- `apps/desktop/src/lib/realtime/useAgentStatus.ts` — port from web.
- `apps/desktop/src/lib/api/postHumanComment.ts` — typed wrapper over `POST /api/tasks/[taskId]/events`.
- `apps/desktop/src/lib/db/agentsWithStatus.ts` — Supabase query against the view, RLS-scoped.

**Acceptance:**
- Window opens to the right size, title bar shows traffic lights (native).
- TeamRail lists every workspace agent with current status badge, hue-tinted active border, click-to-select.
- AgentChatPanel renders the most recent `human.commented` events as bubbles; ChatComposer sends new ones.
- "Open chat ↗" from popover Task detail brings the right agent into focus.
- LeaderboardRail is rendered as the v2 stub.
- Sub-tabs Chat / Activity / Logs render — Chat is the live timeline, Activity shows recent commits/PRs from `task_events`, Logs is a v2 stub.

**Dependencies:** M2, M6.

### M8 — Settings drawer (S)

**Goal:** the Settings IconBtn in `PopoverHeader` opens the Settings drawer popover view (06) showing cards for Workspace, GitHub repos, Brains (v2 stub), Capabilities (v2 stub), Team (v2 stub), Notifications, Billing (stub), Danger zone (stub). Each card's CTA opens the expanded window's Settings sub-page (only GitHub is wired in v1).

**Files / dirs touched:**
- `apps/desktop/src/routes/popover/settings.tsx`.
- `apps/desktop/src/components/settings-drawer/{SettingsCard.tsx,TagPill.tsx,RowKV.tsx,RowChips.tsx,SpendBar.tsx}`.
- `apps/desktop/src/lib/db/{workspace.ts,repositories.ts,workspaceSettings.ts,members.ts}` — RLS-scoped Supabase reads.
- Wire **Open settings ↗** to expanded window settings route.

**Acceptance:**
- Cards show real workspace data (members count, enabled repo count, notification setup status).
- Brains / Capabilities / Team cards render with the v2-stub messaging.
- Clicking the GitHub card opens the expanded window's GitHub subpage.

**Dependencies:** M3, M7.

### M9 — Settings · GitHub subpage (S)

**Goal:** the Settings · GitHub sub-page in the expanded window renders the connection card + repository list with enable toggles + environments cards, all wired to existing web endpoints.

**Files / dirs touched:**
- `apps/desktop/src/routes/expanded/settings/github.tsx`.
- `apps/desktop/src/components/settings-github/{ConnectionCard.tsx,RepoRow.tsx,EnvironmentCard.tsx}` — port from design.
- `apps/desktop/src/lib/api/{github.ts,environments.ts}` — typed wrappers for `GET /api/github/repos`, `POST /api/github/repos/enable`, `DELETE /api/github/repos/[repoId]`, `GET/POST /api/environments`, `PATCH/DELETE /api/environments/[id]`, `PUT /api/environments/[id]/env-vars`.
- Connect-GitHub flow: button opens system browser to `GET /api/auth/github` (which already redirects to the App install page). After install, the callback lands on the web `/settings?github_connected=true`; the desktop polls `/api/github/repos` every few seconds while the user has the install tab open, or shows a "Done" button to re-fetch.
- `apps/desktop/src/components/shell/SettingsShell.tsx` — port left-nav shell.

**Acceptance:**
- Connect GitHub flow opens browser, returns to a working repo list.
- Toggling a repo enable/disable persists.
- Search filters repos.
- Environments display with branch + auto-merge toggle.
- Env vars edit opens an in-app modal (no design — improvise tight Settings-style modal).

**Dependencies:** M7.

### M10 — Native plumbing: notifications + deep links (M)

**Goal:** the app fires native macOS notifications on selected `task_events`, registers `robin://` for deep linking, supports a system-tray "Quit" / "Sign out" / "Preferences", optionally launches at login.

**Files / dirs touched:**
- `apps/desktop/src-tauri/src/{notifications.rs,deeplink.rs}`.
- `apps/desktop/src/lib/notifications/{handlers.ts,subscriptions.ts}` — workspace-wide `task_events` subscription that fires native notifications on `agent.blocked`, `task.completed`, `task.failed`, `agent.pr.opened`. Respect per-user notification preferences (read from `workspace_settings.notify_*` — extend with `notify_native_desktop` boolean).
- `apps/desktop/src-tauri/Info.plist` (via `tauri.conf.json`) — register URL scheme.
- `apps/desktop/src/lib/router/deeplink.ts` — handle `robin://task/<id>`, `robin://agent/<id>`.
- Optional: `tauri-plugin-autostart` for launch-at-login (off by default).
- `apps/web/app/api/workspace/settings/route.ts` — extend to include `notify_native_desktop`.
- `supabase/migrations/00XX_native_notifications_flag.sql` — `workspace_settings.notify_native_desktop boolean NOT NULL DEFAULT true`.

**Acceptance:**
- An `agent.blocked` event in another window fires a banner with the agent name + question.
- Clicking the banner opens the task detail in the popover.
- `robin://task/<uuid>` from a `command-click` outside the app opens the popover at that task.
- Notification preferences in `/settings` (web) include "Show macOS notifications" toggle.

**Dependencies:** M4 (event projection — notifications subscribe to the same workspace `task_events` channel), M7 (deep-link target `robin://agent/<id>` requires the expanded window).

### M11 — Disconnected state + offline cache (S)

**Goal:** when Supabase Realtime drops or the JWT is invalid, the app shows the ported `_v1-dark/view-disconnected.jsx` (re-themed to light) over the last-rendered popover view with a retry CTA. The last snapshot per popover view is persisted in `tauri-plugin-store` and rendered on cold start before the first Realtime tick.

**Files / dirs touched:**
- `apps/desktop/src/lib/realtime/connectionState.ts` — single source of truth for connection status across hooks.
- `apps/desktop/src/components/shell/DisconnectedOverlay.tsx` — port + light-theme.
- `apps/desktop/src/lib/storage/snapshots.ts` — per-view JSON snapshot persistence.

**Acceptance:**
- Forcibly disconnect Supabase (kill connection in dev) → disconnected overlay appears within 5s.
- Reconnect → overlay dismisses.
- Cold start shows last snapshot for ~200ms before live data overrides.

**Dependencies:** M4, M5, M7.

### M12 — Distribution: codesign + notarize + auto-update (M)

**Goal:** GitHub Actions builds, signs, notarizes, and publishes a `.dmg` + Tauri updater manifest on every `desktop-vX.Y.Z` tag.

**Files / dirs touched:**
- `.github/workflows/desktop-release.yml` — matrix `macos-latest` only.
- `apps/desktop/src-tauri/tauri.conf.json` — updater endpoint, signing key.
- Apple Developer Program: register App ID, create Developer ID Application cert, App-specific password for notarytool. Store as GH Actions secrets.
- R2 bucket or Vercel Blob for `manifest.json` + `.dmg`.
- `apps/web/app/(marketing)/desktop/page.tsx` — download page (auto-fetches latest version from manifest).
- `apps/desktop/CHANGELOG.md`.
- README updates root + apps/desktop.

**Acceptance:**
- Tag `desktop-v0.1.0` on `main` → CI produces signed/notarized DMG.
- Manifest published; running the app prompts for update when a new version is released.
- Download page links to current DMG.

**Dependencies:** M9, M10, M11.

### M13 — Hardening + ship (S)

**Goal:** crash reporting (Sentry desktop integration), telemetry minimal (launches, sign-in success rate, version), final QA pass against the design canvas, founder UAT.

**Files / dirs touched:**
- `apps/desktop/src/lib/telemetry/sentry.ts` — Sentry browser SDK in renderer + Sentry Rust SDK in Tauri main.
- `apps/desktop/src/lib/telemetry/events.ts` — minimal event taxonomy (no user content).
- QA checklist file at `apps/desktop/QA.md` covering each design artboard at 1× / 2× zoom, both themes.

**Acceptance:**
- Crash → Sentry issue created.
- Each design view rendered correctly (eyeballing).
- Founder green-lights for first external download.

**Dependencies:** M12.

---

## Risks register

Top five risks with mitigations.

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| **R1** | **Code-signing / notarization friction.** Apple Developer Program approval delays + first-time notarization failures eat days. Notarytool requires hardened runtime + entitlements + correct provisioning profile. | High | High | Start the Apple Developer enrollment in **week 1** (M0), before any UI work. Run a "hello world" Tauri build through the full notarize pipeline early. Keep a runbook of recovery from common notarization errors (`com.apple.security.cs.allow-jit`, etc.). |
| **R2** | **Clerk session in a non-browser context.** The Clerk-templated `supabase` JWT pattern works but the **system-browser → `robin://` handoff** is the most platform-fragile step (browser blockers, redirect race conditions, multiple Clerk environments). | High | High | Implement M1 against Clerk's **dev environment** first; smoke-test against multiple browsers (Safari default, Chrome default, Arc). Fall back to a manual-token paste in a hidden Preferences pane as an emergency hatch. Have a `device tokens` minor variant on standby. |
| **R3** | **Supabase Realtime + RLS edge cases on a different client.** The web client has accumulated quiet workarounds (`supabase.realtime.setAuth` ordering, `agent_status` realtime is unfiltered today, `task_events` is append-only). A desktop client hitting the same channels may surface latent issues. | Medium | High | Mirror the web hooks exactly in M1 + M4. Run M4 against a workspace with active sprints before going further. Add a `workspace_id` filter to the `agent_status` subscription (per `docs/desktop-client-api-map.md:108-110`). |
| **R4** | **Design-to-code gaps on empty / error / loading / first-run.** The design canvas does not include sign-in, first-run, empty inbox, agent offline, repo access lost, GitHub disconnected, or any loading skeleton. These will surface during build and slow milestones if not designed before they're hit. | Very high | Medium | **Block M3 onwards on a 2-day "design gap" session** with the founder to produce light-theme variants of: sign-in, first-run, empty Inbox, empty In progress, empty History, disconnected state, generic error toast, generic loading skeleton, GitHub-disconnected state. Use the existing `_v1-dark/view-disconnected.jsx` as the starting point. |
| **R5** | **Distribution channel / update URL not decided.** Hosting the manifest on Vercel Blob vs Cloudflare R2 vs S3 has implications for cost, edge latency, and security. If we ship without a clear answer, we'll re-sign every binary when we move. | Medium | Medium | Decide hosting in M0 (favour R2 for cost + CDN parity). Codesign + update keys live in 1Password Vault with founder access; rotate procedure documented before M12. |

**Other notable risks (not top-5 but on watchlist):**
- **BUG-ORC-01 / BUG-ORC-02** (root `CLAUDE.md:100-104`) — the desktop will surface state transitions and rework triggers that the orchestrator handles inconsistently today. Don't let the desktop accidentally regress fix work; coordinate with Sprint C planning.
- **Single-instance behaviour** — clicking the tray while the popover is open should toggle it, while running a second `.app` instance must focus the existing instance. `tauri-plugin-single-instance` handles this but needs careful wiring.
- **Privacy / clipboard** — Copy button on inbox cards puts a first-person paragraph on the clipboard. Confirm no sensitive content (API keys, env vars) can ever leak via the body templater.

---

## Out of scope (v1) — deliberately deferred to v2

These features are designed but **not** shipping in v1, each with a reason.

1. **Robin orchestrator chat (`view-new-task`).** Natural-language task assignment with `@agent` routing has no backend, requires an AI orchestration endpoint, and overlaps semantically with the existing **AI Brainstorm** (`/api/ai/brainstorm`) — those need to be reconciled at product level before building. Workaround in v1: task creation goes through the web at `https://app.robin.dev/tasks/new`, optionally opened via menu-bar "New task →".
2. **Brains + Subscriptions matrix (`view-settings-models`).** Per-provider API key + monthly cap + spend tracking + per-agent override + auto-switch rule on cap. Brand-new schema (`workspace_subscriptions`, `workspace_brains`, `agent_brain_overrides`, `auto_switch_rules`) and a metering pipeline that doesn't exist today.
3. **Avatar Workshop (`view-avatar-workshop`).** Dicebear `adventurer` configurator is a delight feature; `agents.avatar_url` exists but no editor. Defer until v2; v1 uses static Dicebear seeds.
4. **Capabilities marketplace (`view-capabilities`).** Marketplace metadata (rating, official, installed_by, installs, popular, tags) is brand-new and the "install per workspace/agent" UX requires a clarified product spec. Maintenance Agents is the closest backend cousin and the surface area is large enough to warrant its own milestone.
5. **Leaderboard / XP / podium (`view-expanded.jsx` right rail).** Pure gamification, no backend. Render a v2-stub card in v1.
6. **Profile editing + Hire engineer flow (`view-settings-agents` actions).** Display-only listing in v1; edit / hire / dispose-with-confirm UX defers to v2 alongside the Avatar Workshop.
7. **Native dark mode.** v1 ships **light theme only** to reduce per-screen QA × 2. The CSS-var infrastructure (M2) supports both; the toggle is just not surfaced. Re-enable in v2 with system-follow.
8. **Windows / Linux builds.** Tauri supports them but signing + notarization + the menu-bar paradigm don't transfer cleanly. macOS-first.
9. **Multi-workspace switcher.** Web today routes single-workspace-per-user; desktop inherits that. If the product supports multiple workspaces per user later, add a workspace picker in the Settings drawer + tray menu.
10. **Offline mode beyond "show last snapshot".** Real offline (write queue, conflict resolution, full SQLite cache) waits for v2.
11. **AI-summarised Inbox letters.** v1 letters use a deterministic template (`headline = task.title`, `body = templated from outcome`). True AI-summarised first-person letters are a v2 polish.
12. **Logs sub-tab in the AgentChatPanel.** Rendering raw agent logs requires either tailing from the VPS (we don't expose that) or persisting log snapshots in DB (new). Defer; surface only on v2.
13. **Push notifications when the app is closed.** macOS allows banners only while the app process is alive. Background daemon mode is a future investment.

---

## Open questions for the founder

These must be resolved before milestones M3+ (popover) or M7+ (expanded window) begin. Group A is **blocking M3**, Group B is **blocking M7**, Group C is **blocking M10/M12**, Group D is **post-v1**.

### Group A — blocks M3 (popover work)

1. **First-run flow.** A user installs the app, opens it for the first time, has never used Robin. What do they see? Options:
   - (a) Sign-in screen → after sign-in: if no workspace, redirect to `https://app.robin.dev/onboarding/workspace`; if workspace exists, land in Inbox.
   - (b) Sign-in screen → in-app workspace creation (duplicates the web onboarding form).
   - Recommendation: **(a)** — keep workspace creation on web for v1.
2. **Empty Inbox / empty In progress / empty History — design intent?** No mocks exist. Recommendation: tight "Nothing here yet" centered text + an action ("Create your first task →" opens browser).
3. **Menu-bar global hotkey.** What summons the popover? Cmd+Shift+R? Cmd+Opt+R? User-configurable in Preferences? Recommendation: **Cmd+Shift+R** as default, surfaced in Preferences when v2 ships a Preferences pane.
4. **Tab transitions.** The design's `TabStrip` shows three tabs with counts, but the prototype doesn't actually switch them. Confirm: clicking a tab switches the popover view via route, **with no animation** (best for menu-bar feel).
5. **Copy button payload.** What exactly goes on the clipboard for a "shipped" letter? Just the body? Body + headline? Body + PR URL? Recommendation: **headline + blank line + body + blank line + PR URL** (markdown-safe).
6. **`agents.hue` source of truth.** Should hue be DB column with admin override, or always derived from `agent.id` hash? Recommendation: **DB column with hash default** (M5 migration).

### Group B — blocks M7 (expanded window)

7. **AgentChatPanel semantics.** The design implies "chat with this engineer". v1 wires it to `human.commented` events on the agent's current task. Is this the right semantic, or should it be a workspace-wide chat with the agent across tasks? **Recommendation: scope to the current task only in v1** — agent without a current task shows an empty state.
8. **Mid-stream agent reply.** Does the AgentChatPanel render the agent's response as it streams, or only when complete? Today, no streaming surface exists from the orchestrator. **Recommendation: render only completed events in v1; revisit when the orchestrator surfaces a streaming channel.**
9. **TeamRail order.** By recent activity? By role? By name? Hue order? **Recommendation: most-recently-active first**, then by status (working > available > onboarding > off).
10. **`SETTINGS_NAV` placement of `Capabilities`.** Design has Capabilities both as a `SETTINGS_NAV` entry and a top-level WindowShell view. Pick one. **Recommendation: `SETTINGS_NAV` entry, since the rest of the IA treats subpages that way.** Move `view-capabilities.jsx`'s shell into `SettingsShell` for v2.

### Group C — blocks M10 / M12 (native plumbing + release)

11. **Notification preferences.** Per-workspace? Per-user? Stored where? Recommendation: per-workspace on `workspace_settings` (matches existing email/Slack channels), add `notify_native_desktop` boolean.
12. **`robin://` URL scheme name.** `robin://` confirmed? Risk of collision with anything else?
13. **Auto-update channel hosting.** R2 vs Vercel Blob vs S3. Decide before M12.
14. **Sentry org / project.** Reuse the web's Sentry, or new project? Cost vs visibility trade-off.
15. **Launch at login default.** On or off by default? Recommendation: **off**; enable from Preferences once that pane exists.

### Group D — post-v1

16. **AI-summarised letters.** v2 design + endpoint.
17. **Capabilities marketplace.** Full product spec.
18. **Robin orchestrator chat vs AI Brainstorm.** Reconcile the two.
19. **Brains / Subscriptions schema.** Full migration design.
20. **Streaming agent reply surface.** Requires an orchestrator change.

---

## Appendix A — files referenced

**Design source (`apps/desktop/design/Robin.dev/`):** `Robin Desktop Client.html`, `theme.jsx`, `data.jsx`, `design-canvas.jsx` (tooling only), `popover-chrome.jsx`, `avatar.jsx`, `chat.jsx`, `tweaks-panel.jsx` (tooling only), `view-inbox.jsx`, `view-sprint.jsx`, `view-task-detail.jsx`, `view-new-task.jsx`, `view-activity.jsx`, `view-settings-panel.jsx`, `view-settings-agents.jsx`, `view-settings-models.jsx`, `view-settings-github.jsx`, `view-expanded.jsx`, `view-avatar-workshop.jsx`, `view-capabilities.jsx`, `view-agents.jsx` (legacy, do not port), `_v1-dark/view-disconnected.jsx` (light-theme port required).

**Web reference (`apps/web/`):**
- Auth + middleware: `middleware.ts`, `lib/api/requireWorkspace.ts`, `lib/auth/sso.ts`, `app/api/auth/session/route.ts`, `lib/supabase/{server,client,admin}.ts`.
- Realtime hooks (copy-port targets): `lib/realtime/{useTaskEventsFeed,useDashboardFeed,useAgentStatus,useActiveTask}.ts`.
- Projection (copy-port target): `lib/db/projectTaskState.ts`, `lib/events/narrativize.ts`.
- GitHub: `lib/github/app.ts`, `app/api/auth/github/*`, `app/api/github/repos/*`, `app/api/environments/*`.
- Task & sprint API: `app/api/tasks/*`, `app/api/sprints/*`.
- Connector reference (model to emulate, do not reuse): `app/api/connector/actions/route.ts`.

**Docs:**
- `docs/desktop-client-api-map.md` (companion reference — Italian) — REST + Realtime catalogue.
- `docs/architecture.md` — Clerk + Supabase JWT bridge, RLS posture, ADR-08 Realtime.
- `docs/schema.md` — tables, views, RLS.
- `docs/events.md` — `task_events` payload union + projection.
- `docs/security.md` — RLS pattern + service-role boundary.
- `docs/runbook.md`, root `CLAUDE.md` — operational constraints, BUG-ORC-01/02.

**Shared types:** `packages/shared-types/src/index.ts` (924 lines, single source).

---

## Appendix B — what is *deliberately* NOT in this plan

- A Figma file or visual mock. The design source IS the visual mock.
- Per-component CSS detail. M2 produces the primitives; this plan does not enumerate each rule.
- Backend orchestrator changes. The desktop client does not change orchestrator behaviour — every milestone reuses existing orchestrator + queue surfaces.
- A Windows or Linux build plan. macOS only.
- A pricing or growth plan for the desktop download.

---

*End of plan.*
