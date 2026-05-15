# @robin/desktop changelog

All notable changes to the macOS desktop client.

## [Unreleased]

### Added — initial scaffolding (matches `docs/desktop-implementation-plan.md`)
- M0 — Tauri v2 + Vite + React + TypeScript shell with tray, popover, expanded,
  auth, deeplink, notification modules.
- M1 — System-browser sign-in flow with PKCE-shaped state + opaque link
  codes, Keychain-stored session, automatic Supabase JWT refresh.
- M2 — Light-canonical design tokens, Tailwind palette, 17 primitives,
  `/_internal/stories` route.
- M3 — Popover shell with persistent header + TabStrip.
- M4 — Inbox letters from `task_events` with realtime updates, copy + mark
  read state in `tauri-plugin-store`.
- M5 — In-progress cards and history feed with agent-hue lanes. New column
  `agents.hue` (migration `0021_agents_hue.sql`).
- M6 — Task detail view with ported `projectTaskState` + `narrativize` and
  per-task event timeline.
- M7 — Expanded window with TeamRail, AgentChatPanel, LeaderboardRail stub.
- M8 — Settings drawer with workspace, GitHub, and v2-stub cards.
- M9 — Settings · GitHub subpage (connection, repo list, environments).
- M10 — Native notifications + `robin://` deep links. New column
  `workspace_settings.notify_native_desktop` (migration `0022_…`).
- M11 — Disconnected overlay + per-view JSON snapshot cache.
- M12 — GitHub Actions workflow for codesign + notarize + R2 upload + Tauri
  updater manifest. **External setup required:**
  - Apple Developer Program enrolment.
  - Developer ID Application cert (`APPLE_CERTIFICATE_BASE64`,
    `APPLE_CERT_PASSWORD`, `APPLE_SIGNING_IDENTITY`).
  - notarytool app-specific password (`APPLE_ID`, `APPLE_NOTARY_PASSWORD`,
    `APPLE_TEAM_ID`).
  - Tauri updater signing keypair (`TAURI_SIGNING_PRIVATE_KEY`, password).
  - Cloudflare R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
    `R2_ACCOUNT_ID`).
- M13 — Sentry init, telemetry event taxonomy, `apps/desktop/QA.md` checklist.

### Notes for the first reviewer
- The crate versions in `src-tauri/Cargo.toml` are pinned to the Tauri v2
  majors current at planning time (2026-05). They may need a `cargo update`
  on the first run.
- Icon files are not committed; generate with
  `npx @tauri-apps/cli icon path/to/source.png` before the first build.
- The renderer-side PKCE flow uses Web Crypto (`crypto.subtle.digest`),
  available in macOS WebKit ≥ 13.

## Releases

_None yet._ Tag the first release as `desktop-v0.1.0` to trigger CI.
