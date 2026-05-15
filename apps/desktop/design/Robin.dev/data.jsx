// Robin · v4 data — inbox notifications + leaderboard + chat threads.
// Engineers now post inbox notifications: shipped / failed / review.

const MOCK_WORKSPACE = {
  id: "ws_8f3e",
  name: "Kakashi Ventures",
  member: "Marco",
  memberEmail: "marco@kakashi.ventures",
  region: "eu-central-1",
  founded: "Mar 2025",
};

const MOCK_AGENTS = [
  {
    id: "agt_01", name: "Aria Chen", handle: "aria",
    role: "Backend Engineer",
    bio: "Payments, APIs, and the unglamorous bits of distributed systems.",
    specialty: ["payments", "go", "postgres"],
    hue: 162, initials: "AC",
    photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=aria-chen&backgroundColor=b6e3f4",
    avatar_config: { style: "adventurer", seed: "aria-chen", backgroundColor: "b6e3f4" },
    status: "working",
    last_seen: "2 seconds ago",
    onboarded: "Apr 2025",
    workstation: {
      label: "Workstation 01",
      specs: "4 cores · 8 GB · 80 GB SSD",
      location: "Helsinki",
      provider: "Hetzner",
      raw: "hel1-cx21",
      cpu: 62, ram: 71,
    },
    brain: "Claude Sonnet 4.5",
    current_task_id: "t_104",
    repos: [
      { id: "r_22", full_name: "kakashi/api-gateway" },
      { id: "r_23", full_name: "kakashi/billing-core" },
    ],
  },
  {
    id: "agt_02", name: "Marcus Reyes", handle: "marcus",
    role: "Frontend Engineer",
    bio: "React, Next.js, and pixel-honest UI work.",
    specialty: ["react", "typescript", "design"],
    hue: 268, initials: "MR",
    photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=marcus-reyes&backgroundColor=d1d4f9",
    avatar_config: { style: "adventurer", seed: "marcus-reyes", backgroundColor: "d1d4f9" },
    status: "working",
    last_seen: "1 second ago",
    onboarded: "Apr 2025",
    workstation: { label: "Workstation 02", specs: "4 cores · 8 GB · 80 GB SSD", location: "Helsinki", provider: "Hetzner", raw: "hel1-cx21", cpu: 38, ram: 54 },
    brain: "Claude Sonnet 4.5",
    current_task_id: "t_109",
    repos: [{ id: "r_31", full_name: "kakashi/web-app" }],
  },
  {
    id: "agt_03", name: "Yuki Tanaka", handle: "yuki",
    role: "Mobile Engineer",
    bio: "iOS, Swift, the calm one who reads Apple release notes for fun.",
    specialty: ["swift", "ios", "push-notifications"],
    hue: 36, initials: "YT",
    photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=yuki-tanaka&backgroundColor=ffd5a8",
    avatar_config: { style: "adventurer", seed: "yuki-tanaka", backgroundColor: "ffd5a8" },
    status: "working",
    last_seen: "4 seconds ago",
    onboarded: "May 2025",
    workstation: { label: "Workstation 03", specs: "4 cores · 8 GB · 80 GB SSD", location: "Falkenstein", provider: "Hetzner", raw: "fsn1-cx21", cpu: 32, ram: 41 },
    brain: "Claude Sonnet 4.5",
    current_task_id: "t_111",
    repos: [{ id: "r_44", full_name: "kakashi/mobile-ios" }],
  },
  {
    id: "agt_04", name: "Nora Kim", handle: "nora",
    role: "Design Systems",
    bio: "Components, accessibility, motion. Won't ship a Button without forwardRef.",
    specialty: ["design-systems", "react", "a11y"],
    hue: 340, initials: "NK",
    photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=nora-kim-2&backgroundColor=ffd5dc",
    avatar_config: { style: "adventurer", seed: "nora-kim-2", backgroundColor: "ffd5dc" },
    status: "available",
    last_seen: "1 second ago",
    onboarded: "Apr 2025",
    workstation: { label: "Workstation 04", specs: "4 cores · 8 GB · 80 GB SSD", location: "Falkenstein", provider: "Hetzner", raw: "fsn1-cx21", cpu: 2, ram: 21 },
    brain: "Claude Haiku 4.5",
    current_task_id: null,
    repos: [{ id: "r_55", full_name: "kakashi/design-system" }],
  },
  {
    id: "agt_05", name: "Theo Reiss", handle: "theo",
    role: "Infrastructure",
    bio: "K8s, Terraform, observability. Lives in the dashboard.",
    specialty: ["devops", "terraform", "kubernetes"],
    hue: 200, initials: "TR",
    photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=theo-reiss&backgroundColor=c0e8f9",
    avatar_config: { style: "adventurer", seed: "theo-reiss", backgroundColor: "c0e8f9" },
    status: "onboarding",
    last_seen: "—",
    onboarded: "today",
    workstation: { label: "Workstation 05", specs: "4 cores · 8 GB · 80 GB SSD", location: "Nuremberg", provider: "Hetzner", raw: "nbg1-cx21", cpu: 0, ram: 0 },
    brain: "Claude Sonnet 4.5",
    current_task_id: null,
    repos: [{ id: "r_61", full_name: "kakashi/infra" }],
  },
  {
    id: "agt_06", name: "Sofia Marchetti", handle: "sofia",
    role: "QA & Reliability",
    bio: "Property-based tests, chaos engineering, sleeping pager.",
    specialty: ["testing", "playwright", "reliability"],
    hue: 6, initials: "SM",
    photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=sofia-marchetti&backgroundColor=ffb6b6",
    avatar_config: { style: "adventurer", seed: "sofia-marchetti", backgroundColor: "ffb6b6" },
    status: "available",
    last_seen: "30 seconds ago",
    onboarded: "Apr 2025",
    workstation: { label: "Workstation 06", specs: "4 cores · 8 GB · 80 GB SSD", location: "Helsinki", provider: "Hetzner", raw: "hel1-cx21", cpu: 4, ram: 18 },
    brain: "Claude Sonnet 4.5",
    current_task_id: null,
    repos: [{ id: "r_70", full_name: "kakashi/cli" }],
  },
];

// Active tasks — only what's being worked on now.
const MOCK_TASKS = [
  {
    id: "t_104",
    title: "Add Stripe webhook retry with exponential backoff",
    repo: "kakashi/billing-core",
    branch: "feat/webhook-retry",
    status: "in_progress",
    priority: "high",
    agent_id: "agt_01",
    pr_number: 412,
    started: "23 minutes ago",
    progress: 0.6,
    current_activity: "wiring retry budget into webhook handler",
    description: "Wrap outbound Stripe webhook calls in a RetryBudget helper that does exponential backoff (250ms → 8s, cap 5). 5xx and 429 go through the retry budget; 4xx (except 429) stay terminal. Roll out under a feature flag so we can disable in seconds if Stripe changes their idempotency semantics. Acceptance: integration tests for 502/503/504/429 paths, alerting on dead-letter rate above 0.5%.",
  },
  {
    id: "t_109",
    title: "Migrate dashboard to React Server Components",
    repo: "kakashi/web-app",
    branch: "feat/rsc-migration",
    status: "in_progress",
    priority: "med",
    agent_id: "agt_02",
    started: "1 hour ago",
    progress: 0.4,
    current_activity: "moving data fetching to server components",
    description: "Migrate the dashboard route from a client-fetched SWR setup to React Server Components. Goal: shave 600ms off TTI on the cold path and remove the request waterfall between /me and /workspace. Keep client-side interactivity (filter chips, search) as Client Components. Acceptance: dashboard p75 TTI under 800ms, no regressions in Sentry interaction traces.",
  },
  {
    id: "t_111",
    title: "Fix push-notification token rotation on iOS 18",
    repo: "kakashi/mobile-ios",
    branch: "fix/apns-rotation",
    status: "in_progress",
    priority: "high",
    agent_id: "agt_03",
    started: "23 minutes ago",
    progress: 0.3,
    current_activity: "writing rotation handler · 3 of 7 tests passing",
    description: "iOS 18 changed the default keychain ACL behaviour — the existing APNs rotation path silently fails to read the device token after a key roll. Wire a fallback that uses the legacy ACL flag when the device is on iOS 18, gate behind feature flag, instrument with a custom event so we can watch the success rate. Acceptance: PushNotificationsTests green, manual rotation on staging works end-to-end on a fresh iOS 18 device.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Inbox — agents report what they've done or where they got stuck.
// Each notification is a short letter from the agent.
//   kind: "shipped" | "review" | "failed" | "blocked-cleared"

const MOCK_INBOX = [
  {
    id: "n_01",
    kind: "review",
    agent_id: "agt_01",
    at: "4 minutes ago",
    unread: true,
    task_title: "Add audit log for workspace settings changes",
    repo: "kakashi/api-gateway",
    headline: "Ready for review",
    body: "Wrapped up the audit log work. Every workspace mutation now emits an `audit_log` row with the actor, the previous + next value, and the request id. I added Playwright coverage for the three highest-risk paths (rename, mcp config update, member role change). PR is small, ~180 lines.",
    pr: { number: 408, url: "github.com/kakashi/api-gateway/pull/408", additions: 184, deletions: 12 },
    duration: "2 h 14 m",
    tokens: "1.4 M",
    tags: ["audit-log", "+184 / -12"],
  },
  {
    id: "n_02",
    kind: "failed",
    agent_id: "agt_06",
    at: "27 minutes ago",
    unread: true,
    task_title: "Upgrade SDK to Node 22 in workers/",
    repo: "kakashi/workers",
    headline: "Couldn't finish — flaky tests blocking",
    body: "Got 8/9 packages compiling on Node 22 but the `workers/scheduler` suite hangs intermittently. Looked like a `node:test` runner regression on Node 22.0.x. I rolled the dependency back to 20.18 on that package and queued a follow-up for when 22.1 drops. No code shipped.",
    error: "TimeoutError: scheduler-suite hung for >30s · seen 3/5 runs",
    duration: "47 m",
    tokens: "380 K",
    tags: ["node-22", "rolled back"],
  },
  {
    id: "n_03",
    kind: "shipped",
    agent_id: "agt_01",
    at: "47 minutes ago",
    unread: false,
    task_title: "Upgrade Postgres driver to 16.4",
    repo: "kakashi/api-gateway",
    headline: "Shipped",
    body: "Bumped pg from 16.2 to 16.4 across services. Patched the one breaking change (`pg.types.setTypeParser` signature), regenerated lockfiles, ran the full integration suite — all green. Merged after Marco's approval.",
    pr: { number: 401, url: "github.com/kakashi/api-gateway/pull/401", additions: 32, deletions: 28, merged: true },
    duration: "1 h 9 m",
    tokens: "720 K",
    tags: ["postgres", "+32 / -28"],
  },
  {
    id: "n_04",
    kind: "shipped",
    agent_id: "agt_04",
    at: "2 hours ago",
    unread: false,
    task_title: "Refactor Button component to use forwardRef",
    repo: "kakashi/design-system",
    headline: "Shipped",
    body: "Migrated Button to forwardRef. Added the missing `asChild` prop while I was in there. Storybook stories updated, visual regressions clean.",
    pr: { number: 224, url: "github.com/kakashi/design-system/pull/224", additions: 41, deletions: 19, merged: true },
    duration: "38 m",
    tokens: "210 K",
    tags: ["+41 / -19"],
  },
  {
    id: "n_05",
    kind: "review",
    agent_id: "agt_02",
    at: "yesterday · 17:42",
    unread: false,
    task_title: "Add empty state for /billing when no invoices exist",
    repo: "kakashi/web-app",
    headline: "Ready for review",
    body: "Added the empty state with illustration + CTA. Honestly the copy could use a second pair of eyes — happy to revise.",
    pr: { number: 519, url: "github.com/kakashi/web-app/pull/519", additions: 88, deletions: 4 },
    duration: "52 m",
    tokens: "540 K",
    tags: ["UI"],
  },
  {
    id: "n_06",
    kind: "failed",
    agent_id: "agt_03",
    at: "yesterday · 14:08",
    unread: false,
    task_title: "Enable Live Activities in iOS app",
    repo: "kakashi/mobile-ios",
    headline: "Blocked on entitlement",
    body: "I can wire Live Activities in 30 min, but the app entitlement needs to be added in App Store Connect before builds will sign. That's a control-panel action — paused the task.",
    duration: "11 m",
    tokens: "84 K",
    tags: ["needs entitlement"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// History — git-style commits across the team. Mixed agents, oldest at bottom.

const MOCK_HISTORY = [
  { id: "h01", agent_id: "agt_01", sha: "a3f12c", message: "wire backoff helper into webhook handler", repo: "billing-core", at: "34 seconds ago", branch: "feat/webhook-retry" },
  { id: "h02", agent_id: "agt_02", sha: "9c4e10", message: "move data fetching to server components", repo: "web-app", at: "6 minutes ago", branch: "feat/rsc-migration" },
  { id: "h03", agent_id: "agt_01", sha: "881e44", message: "extract retry config into module", repo: "billing-core", at: "11 minutes ago", branch: "feat/webhook-retry" },
  { id: "h04", agent_id: "agt_03", sha: "f81a02", message: "stub rotation handler", repo: "mobile-ios", at: "16 minutes ago", branch: "fix/apns-rotation" },
  { id: "h05", agent_id: "agt_01", sha: "12bfa9", message: "scaffold backoff helper", repo: "billing-core", at: "19 minutes ago", branch: "feat/webhook-retry" },
  { id: "h06", agent_id: "agt_01", sha: "4b71c2", message: "Merge PR #401 · upgrade postgres to 16.4", repo: "api-gateway", at: "47 minutes ago", branch: "main", merge: true },
  { id: "h07", agent_id: "agt_04", sha: "ee8c50", message: "Merge PR #224 · Button forwardRef", repo: "design-system", at: "2 hours ago", branch: "main", merge: true },
  { id: "h08", agent_id: "agt_02", sha: "773aff", message: "empty state copy + CTA", repo: "web-app", at: "yesterday · 17:39", branch: "feat/empty-billing" },
  { id: "h09", agent_id: "agt_06", sha: "9a1d4e", message: "revert workers/scheduler to node 20.18", repo: "workers", at: "yesterday · 12:11", branch: "main" },
  { id: "h10", agent_id: "agt_01", sha: "6f0238", message: "fix type parser signature for pg 16.4", repo: "api-gateway", at: "yesterday · 10:48", branch: "chore/pg-16" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard — top engineers this week.
// Used in the expanded window's right column.

const MOCK_LEADERBOARD = [
  { agent_id: "agt_01", commits: 47, prs_merged: 3, tasks_shipped: 4, lines: 1280, score: 92 },
  { agent_id: "agt_02", commits: 31, prs_merged: 2, tasks_shipped: 3, lines: 940, score: 78 },
  { agent_id: "agt_04", commits: 24, prs_merged: 3, tasks_shipped: 3, lines: 540, score: 71 },
  { agent_id: "agt_03", commits: 18, prs_merged: 1, tasks_shipped: 1, lines: 410, score: 52 },
  { agent_id: "agt_06", commits: 12, prs_merged: 1, tasks_shipped: 1, lines: 220, score: 38 },
  { agent_id: "agt_05", commits: 0,  prs_merged: 0, tasks_shipped: 0, lines: 0,   score: 0  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Capabilities — a library of skill packs engineers can install into their
// Claude Code instance on their workstation. Think VS Code extensions, but
// curated for AI engineers.

const MOCK_CAPABILITIES = [
  {
    id: "cap_stripe", name: "Stripe Toolkit",
    category: "Backend", tone: "info",
    icon: "card",
    summary: "Webhooks, retries, idempotency, payment-intent helpers, Stripe Connect flows.",
    long: "Wraps stripe-node with idempotent retry helpers, signature verification middleware, and battle-tested patterns for handling webhooks, refunds, and Connect onboarding.",
    version: "v3.2.1", author: "Robin Labs", official: true, popular: true,
    installs: 1240, rating: 4.8,
    installed_by: ["agt_01"],
    tags: ["payments", "webhooks", "go"],
  },
  {
    id: "cap_postgres", name: "Postgres Migrator",
    category: "Backend", tone: "info",
    icon: "database",
    summary: "Safe schema migrations with diff preview and one-click rollback.",
    long: "Compares your schema to migration files, generates safe up/down with explicit locking strategy, and can dry-run in a sandbox before touching prod.",
    version: "v1.8.0", author: "Robin Labs", official: true, popular: true,
    installs: 980, rating: 4.7,
    installed_by: ["agt_01"],
    tags: ["database", "schema", "ops"],
  },
  {
    id: "cap_apns", name: "iOS Push (APNs)",
    category: "Mobile", tone: "warning",
    icon: "bell",
    summary: "Token rotation, entitlement helpers, sandbox vs prod cert switching.",
    long: "Handles the gnarly bits of APNs: keychain ACL on iOS 18+, p8 vs p12 key handling, dev/prod cert switching, and silent push templates.",
    version: "v2.0.0", author: "Yuki Tanaka", official: false,
    installs: 88, rating: 4.6,
    installed_by: ["agt_03"],
    tags: ["ios", "swift", "notifications"],
  },
  {
    id: "cap_rsc", name: "React Server Components",
    category: "Frontend", tone: "accent",
    icon: "react",
    summary: "Migrate client components to RSC with streaming + Suspense patterns.",
    long: "Identifies the boundary between client and server components, refactors data fetching, and adds the right Suspense boundaries without breaking interactivity.",
    version: "v0.9.4", author: "Robin Labs", official: true, popular: true,
    installs: 612, rating: 4.5,
    installed_by: ["agt_02"],
    tags: ["react", "nextjs", "performance"],
  },
  {
    id: "cap_tailwind", name: "Tailwind Components",
    category: "Frontend", tone: "accent",
    icon: "palette",
    summary: "Tailwind v4 + Radix patterns, accessible components, theme tokens.",
    version: "v4.1.0", author: "Nora Kim", official: false,
    installs: 240, rating: 4.9,
    installed_by: ["agt_02", "agt_04"],
    tags: ["css", "tailwind", "a11y"],
  },
  {
    id: "cap_playwright", name: "Playwright E2E",
    category: "Testing", tone: "success",
    icon: "test",
    summary: "Visual regression, network mocking, flaky-test triage.",
    version: "v2.4.0", author: "Sofia Marchetti", official: false,
    installs: 312, rating: 4.7,
    installed_by: ["agt_06"],
    tags: ["testing", "e2e", "ci"],
  },
  {
    id: "cap_property", name: "Property-based Tests",
    category: "Testing", tone: "success",
    icon: "shield",
    summary: "fast-check + shrinking for hairy invariants. Catches what unit tests don't.",
    version: "v1.2.0", author: "Robin Labs", official: true,
    installs: 198, rating: 4.6,
    installed_by: ["agt_06"],
    tags: ["testing", "invariants"],
  },
  {
    id: "cap_terraform", name: "Terraform Modules",
    category: "Infra", tone: "info",
    icon: "cloud",
    summary: "Hetzner, AWS, Cloudflare modules with sane defaults and state best-practices.",
    version: "v5.0.2", author: "Robin Labs", official: true,
    installs: 540, rating: 4.4,
    installed_by: [],
    tags: ["infra", "terraform", "iac"],
  },
  {
    id: "cap_k8s", name: "Kubernetes Helm",
    category: "Infra", tone: "info",
    icon: "container",
    summary: "Helm charts for Robin-style monorepos with secret rotation and HPA.",
    version: "v3.7.1", author: "Robin Labs", official: true,
    installs: 410, rating: 4.3,
    installed_by: [],
    tags: ["kubernetes", "devops"],
  },
  {
    id: "cap_openapi", name: "OpenAPI Generator",
    category: "Backend", tone: "info",
    icon: "spec",
    summary: "Generate typed clients (TS/Swift/Kotlin) from OpenAPI 3.1 schemas.",
    version: "v2.1.0", author: "Aria Chen", official: false,
    installs: 84, rating: 4.5,
    installed_by: ["agt_01"],
    tags: ["api", "codegen"],
  },
  {
    id: "cap_sentry", name: "Sentry Integration",
    category: "Ops", tone: "danger",
    icon: "alert",
    summary: "Auto-instrument, scrub PII, link errors to commits, alert routing.",
    version: "v1.6.0", author: "Robin Labs", official: true,
    installs: 720, rating: 4.6,
    installed_by: [],
    tags: ["monitoring", "errors"],
  },
  {
    id: "cap_design", name: "Figma Bridge",
    category: "Design", tone: "accent",
    icon: "figma",
    summary: "Read Figma frames, generate React + Tailwind that matches pixel-for-pixel.",
    version: "v0.8.0", author: "Nora Kim", official: false, popular: true,
    installs: 156, rating: 4.4,
    installed_by: ["agt_04"],
    tags: ["figma", "design-systems"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Read-only task detail timeline (Yuki on APNs rotation, mid-flight)

const TASK_111_TIMELINE = [
  { type: "task.created", at: "23 minutes ago", actor: "Marco", text: "Created from sprint planning." },
  { type: "agent.assigned", at: "22 minutes ago", actor: "system", text: "Assigned to Yuki." },
  { type: "code.cloned", at: "22 minutes ago", actor: "agt_03", text: "Pulled mobile-ios @ main onto workstation." },
  { type: "agent.thinking", at: "20 minutes ago", actor: "agt_03", text: "Reading APNs rotation docs and the current implementation in PushService.swift." },
  { type: "code.committed", at: "16 minutes ago", actor: "agt_03", text: "Stubbed the rotation handler.", sha: "f81a02" },
  { type: "test.failed", at: "8 minutes ago", actor: "agt_03", text: "PushNotificationsTests · 3 failed (key not found in keychain)." },
  { type: "agent.thinking", at: "5 minutes ago", actor: "agt_03", text: "Looking at how the legacy app handled the keychain ACL before iOS 18." },
  { type: "code.committed", at: "1 minute ago", actor: "agt_03", text: "Wire keychain ACL fallback for iOS 18.", sha: "c4920a" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Robin chat — the orchestrator conversation transcript (for view-new-task).

const ROBIN_CHAT = [
  { role: "robin", at: "just now",
    text: "Hi Marco. I see 3 engineers free this morning — Nora, Sofia, and Theo is still setting up. What's on your mind?" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Agent chat — example conversation between you and Aria (for expanded view).

const ARIA_CHAT = [
  { role: "agent", at: "11 minutes ago",
    text: "Picked up the Stripe retry task. Cloned billing-core. Reading the existing webhook handler — there's an inline retry that I think is hiding more than it helps." },
  { role: "agent", at: "9 minutes ago",
    text: "Drafted a small `RetryBudget` helper with exponential backoff (250ms → 8s, cap 5). I'll wire it under a feature flag so we can roll back instantly if Stripe changes their idempotency semantics." },
  { role: "user", at: "6 minutes ago",
    text: "Sounds good. Also — can you check we handle the case where Stripe responds 5xx? We don't want to count those as terminal failures." },
  { role: "agent", at: "5 minutes ago",
    text: "Good catch. Looked at the code path: 5xx falls into the same bucket as 4xx today (logged + dead-lettered). I'll split that — 5xx and 429 go through the retry budget, 4xx (except 429) stay terminal. ETA 10 min." },
  { role: "agent", at: "34 seconds ago",
    text: "Wired it. 14 tests passing including new coverage for 502 / 503 / 504 / 429. PR is open at #412 if you want to skim — happy to wait on merge until you've seen it." },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

Object.assign(window, {
  MOCK_WORKSPACE, MOCK_AGENTS, MOCK_TASKS,
  MOCK_INBOX, MOCK_HISTORY, MOCK_LEADERBOARD, MOCK_CAPABILITIES,
  TASK_111_TIMELINE, ROBIN_CHAT, ARIA_CHAT,
  getAgent: (id) => MOCK_AGENTS.find(a => a.id === id),
  getTask:  (id) => MOCK_TASKS.find(x => x.id === id),
});
