# @robin/desktop — Robin.dev macOS client

Tauri v2 + Vite + React + TypeScript. Follows the milestone plan in
[`docs/desktop-implementation-plan.md`](../../docs/desktop-implementation-plan.md)
and the API/Realtime map in
[`docs/desktop-client-api-map.md`](../../docs/desktop-client-api-map.md).

## What's scaffolded

| Milestone | Status | Notes |
|-----------|--------|-------|
| M0 Scaffolding | ✅ Files in place | Vite, Tauri config, Rust shell modules, entitlements, `tauri.conf.json`. Icons not generated — see "Before first run". |
| M1 Auth | ✅ Wired | System-browser PKCE-shaped handshake, Clerk-protected `/auth/desktop-handoff`, link-code exchange, Keychain storage, auto-refresh in `SessionContext`. New tables `desktop_link_codes` + `desktop_sessions` (migration `0023_…`). **Still owed:** Clerk dev-env allowlist for `robin://` redirect, `SUPABASE_JWT_SECRET` env on web, end-to-end smoke. |
| M2 Design tokens + primitives | ✅ Complete | CSS vars from `theme.jsx`, Tailwind palette, primitives in `src/components/primitives/`, `/internal/stories` route. |
| M3 Popover shell + tray | ✅ Code in place | Rust tray binding, popover anchoring, `PopoverShell`/`PopoverHeader`/`PopoverFooter`/`TabStrip`. **Untested** — needs first Tauri build. |
| M4 Inbox | ✅ Wired | Letter projection in `lib/inbox/`, realtime via `useInboxFeed`, read state in `lib/storage/inboxRead.ts`. v1 body is templated, not AI-summarised. |
| M5 In-progress + History | ✅ Wired | Includes `supabase/migrations/0021_agents_hue.sql`. Apply before first launch. |
| M6 Task detail | ✅ Wired | `projectTaskState.ts` + `narrativize.ts` are verbatim ports of the web versions. |
| M7 Expanded window | ✅ Wired | TeamRail + AgentChatPanel + LeaderboardRailStub. Chat reads/writes `human.commented` events. Mid-stream agent replies deferred (§B.8). |
| M8 Settings drawer (popover) | ✅ Wired | Workspace + GitHub cards real; Team / Brains / Capabilities / Billing / Danger render as v2 stubs. |
| M9 Settings · GitHub subpage | ✅ Wired | Uses `/api/auth/github`, `/api/github/repos`, `/api/environments` — every endpoint already exists on web. |
| M10 Notifications + deep links | ✅ Scaffolded | Renderer fanout + Rust `notify`/`deeplink` modules. Includes `supabase/migrations/0022_native_desktop_notifications.sql`. |
| M11 Disconnected + snapshot cache | ✅ Wired | `connectionStateStore`, light-theme overlay, `tauri-plugin-store` snapshots. |
| M12 Distribution | ✅ Pipeline written | `.github/workflows/desktop-release.yml` builds + signs + notarises + uploads to R2 + publishes manifest. Marketing download page at `apps/web/app/(marketing)/desktop/page.tsx`. **External setup:** Apple Developer cert + notarytool password + Tauri signing keypair + R2 credentials, all listed in `CHANGELOG.md`. |
| M13 Hardening | ✅ Wired | Sentry init in renderer (`lib/telemetry/sentry.ts`), event taxonomy (`lib/telemetry/events.ts`), QA checklist at `apps/desktop/QA.md`. Rust-side Sentry crate not yet imported — pending founder OK on `VITE_SENTRY_DSN`. |

## External setup still needed

The spec calls out items that cannot be done from code. Code is in place;
these tasks unblock the first end-to-end run:

- **R1 / M12 — Apple notarisation chain.** Enrol in the Apple Developer
  Program, mint a Developer ID Application certificate, generate an
  app-specific password for `notarytool`. Add to GitHub Actions secrets:
  `APPLE_CERTIFICATE_BASE64`, `APPLE_CERT_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
  `APPLE_ID`, `APPLE_NOTARY_PASSWORD`, `APPLE_TEAM_ID`. Also mint a Tauri
  updater keypair (`npx @tauri-apps/cli signer generate`) and add as
  `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- **R2 / M1 — Clerk env + redirect.** Decide which Clerk environment owns the
  desktop sign-in flow. Set `VITE_SIGN_IN_URL` to that environment's hosted
  sign-in URL. Allowlist `robin://auth/callback` in Clerk's Allowed
  Redirect URLs (the actual redirect goes through `/auth/desktop-handoff`
  but Clerk needs the parent scheme).
- **M1 — Web env.** Ensure `SUPABASE_JWT_SECRET` is set on Vercel (same
  secret Clerk's `supabase` template uses). Without it, the web side
  cannot sign desktop JWTs.
- **M12 — R2 hosting.** Set `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_ACCOUNT_ID`, and a public bucket served at `downloads.robin.dev`.
- **M13 — Sentry.** Optionally set `VITE_SENTRY_DSN` (renderer) and a Rust
  Sentry DSN once `sentry` crate is added.
- **A.1–A.6** — First-run / empty states / global hotkey / clipboard payload /
  hue source-of-truth. Defaults applied where the plan recommended; raise
  with founder before M3 visual sign-off.
- **B.7–B.10** — AgentChatPanel semantics, TeamRail ordering, Capabilities IA.
  v1 ships the recommended defaults; revisit with founder pre-launch.
- **C.11–C.15** — Notifications preference (column added in 0022_native_desktop_notifications.sql),
  `robin://` scheme name confirmation, manifest hosting (R2/Vercel/S3),
  Sentry org reuse, launch-at-login default.

## Before first run

1. `npm install` from the repo root — `apps/desktop` is picked up via
   workspaces.
2. Generate icons:
   ```
   npx @tauri-apps/cli icon path/to/source.png \
     --output apps/desktop/src-tauri/icons
   ```
   Bundling requires `icon.icns`, `32x32.png`, `128x128.png`, `128x128@2x.png`,
   plus `tray.png` for the menu-bar icon.
3. Apply the two new migrations:
   ```
   npx supabase db push
   ```
4. Copy `.env.example` → `.env.local` and fill in:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL` (`http://localhost:3000` for local web)
   - `VITE_SIGN_IN_URL` (Clerk-hosted sign-in URL with PKCE params)
5. Web side: add `POST /api/auth/desktop-session` and
   `POST /api/auth/desktop-session/refresh` (not yet implemented). Add both
   paths to `apps/web/middleware.ts` public matcher.
6. Run the renderer alone (`npm run dev -w @robin/desktop`) to verify the
   `/_internal/stories` route against the design canvas.
7. Run the full Tauri shell (`npm run dev:tauri -w @robin/desktop`). On first
   launch the tray icon should appear; clicking it toggles the popover.

## Layout

```
apps/desktop/
├── design/                 ← Babel-standalone design source (reference)
├── src/
│   ├── components/
│   │   ├── primitives/     ← Btn, Avatar, ChatBubble, … (M2)
│   │   ├── shell/          ← PopoverShell, SettingsShell, EmptyState
│   │   ├── inbox/          ← InboxCard, KindTag, PRChip, CopyBtn
│   │   ├── wip/            ← WipCard
│   │   ├── history/        ← HistoryRow, Filter
│   │   ├── task-detail/    ← TimelineEntry, EventIcon
│   │   ├── expanded/       ← TeamRail, AgentChatPanel, LeaderboardRailStub
│   │   ├── settings-drawer/← SettingsCard + v1/v2-stub cards
│   │   └── settings-github/← ConnectionCard, RepoRow, EnvironmentCard
│   ├── lib/
│   │   ├── auth/           ← Keychain-backed session shim
│   │   ├── api/            ← Typed REST wrappers
│   │   ├── db/             ← projectTaskState (ported)
│   │   ├── events/         ← narrativize (ported)
│   │   ├── realtime/       ← useChannel + per-feed hooks
│   │   ├── inbox/          ← projectLetter, kindFor
│   │   ├── storage/        ← inbox-read map, view snapshots
│   │   ├── notifications/  ← native fanout
│   │   ├── router/         ← deeplink wiring
│   │   ├── expanded/       ← cross-window IPC helpers
│   │   ├── session/        ← React context, useSession
│   │   └── supabase/       ← client + applySession(JWT)
│   ├── routes/
│   │   ├── sign-in.tsx
│   │   ├── _internal/stories.tsx
│   │   ├── popover/        ← __layout, inbox, in-progress, history, settings, task.$taskId
│   │   └── expanded/       ← __root, agents.$agentId, settings.github
│   ├── styles/             ← theme.css, globals.css, fonts.css
│   ├── App.tsx
│   ├── main.tsx
│   └── routeTree.ts
└── src-tauri/
    ├── src/                ← main.rs, lib.rs, tray.rs, popover.rs,
    │                         expanded.rs, auth.rs, deeplink.rs, notifications.rs
    ├── icons/              ← placeholder; generate before first build
    ├── Cargo.toml
    ├── build.rs
    ├── entitlements.plist
    └── tauri.conf.json
```

## Known caveats vs. spec

- This scaffold has not been booted in a Tauri runtime in CI. Cargo crate
  versions in `Cargo.toml` are pinned to the v2 majors current at planning
  time (2026-05); resolve at first `tauri dev`.
- `getSupabaseBrowserClient` parity: the web app uses Clerk's `getToken`
  inside every realtime hook. Here, `applySession()` is called once on
  session load. If JWTs expire mid-session, the renderer will need to call
  `applySession` again before resubscribing — pending in M1.
- The `requestAnimationFrame` references inside `ChatComposer` and a few
  inbox helpers will need a `dom` lib reference at TS build time (already in
  the tsconfig's `lib`).
- `SearchInput`/`SearchBox` dedupe (spec §1.2) is implicit — there's a single
  `<input>` in the GitHub subpage rather than a primitive.
