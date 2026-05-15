# Robin desktop — QA checklist

Run this list before each release. Sections map 1:1 to the milestones in
`docs/desktop-implementation-plan.md`.

Conventions:
- 🟢 light theme · 🌑 dark theme (deferred to v2 but exercise once for layout drift)
- 1× / 2× = display scale on retina
- Where the spec calls for a design-canvas comparison, open
  `apps/desktop/design/Robin.dev/Robin Desktop Client.html` side-by-side.

## M0 — Shell + first run
- [ ] Cold launch shows the tray icon within 2 seconds.
- [ ] Quitting via `⌘Q` from any window fully exits the process.
- [ ] Re-opening the `.app` while running focuses the existing instance (single-instance plugin).

## M1 — Auth
- [ ] Fresh `~/Library/Application Support/Robin` shows sign-in page.
- [ ] "Sign in with browser" opens the default browser at the Clerk URL.
- [ ] Completing sign-in returns to `robin://auth/callback` and lands in Inbox.
- [ ] Force-quit during the browser handoff doesn't leave the app in a broken state.
- [ ] `keychain dump dev.robin.desktop` shows exactly one entry for the session.
- [ ] Wait 50–60 min idle → JWT auto-refreshes (logs show
      `[POST /api/auth/desktop-session/refresh]` 200).
- [ ] Sign-out clears the Keychain entry and routes back to sign-in.

## M2 — Tokens + primitives
- [ ] `/_internal/stories` matches design canvas at 1× zoom 🟢.
- [ ] Keyboard focus rings visible on every interactive primitive.

## M3 — Popover
- [ ] Tray click opens popover anchored under the icon, dismisses on outside click.
- [ ] All three tabs render with the chrome present, even with no data.
- [ ] `⌘W` hides popover; does not quit.

## M4 — Inbox
- [ ] 0 letters → empty state copy + CTA visible.
- [ ] ≥ 1 letter → cards render with correct KindTag colour, repo/branch chips.
- [ ] Hover over an unread card marks it read (border fades).
- [ ] "Mark all read" updates badge count in the TabStrip live.
- [ ] Copy button puts `headline\n\nbody\n\nPR URL` on the clipboard.
- [ ] New `task.completed` event in another window appends a card without flicker.

## M5 — In-progress + History
- [ ] WIP card shows live `current_activity` ticker.
- [ ] Expandable description toggles.
- [ ] History grouped Today / Yesterday / Earlier.
- [ ] Lane colour matches `agents.hue` for each agent.
- [ ] Filter "Merges" hides non-merge entries.
- [ ] Filter on a single engineer shows only their commits.

## M6 — Task detail
- [ ] Timeline matches web Task detail page event-for-event.
- [ ] Real-time INSERT on `task_events` appends an entry within ~1s.
- [ ] "Open chat" surfaces the expanded window focused on the right agent.

## M7 — Expanded window
- [ ] Native traffic lights present, window resizable above min size.
- [ ] TeamRail orders working > idle > onboarding > offline.
- [ ] Hue-tinted left border on the active agent.
- [ ] Composer disabled when agent has no current task.
- [ ] Composer-sent comment appears in the thread within 2s.
- [ ] Activity tab shows recent commits/PRs from the same task.
- [ ] Logs tab renders the v2-stub.

## M8 — Settings drawer
- [ ] Workspace card shows correct member + repo count.
- [ ] Notification card reflects current email/Slack setup.
- [ ] v2-stub cards are visibly disabled with "v2" tag.
- [ ] GitHub card click opens the expanded window's GitHub subpage.

## M9 — Settings · GitHub
- [ ] "Connect GitHub" opens system browser and lands back on the page with the repo list populated after re-fetch.
- [ ] Toggling a repo enable/disable persists across reload.
- [ ] Search filters the list with no flicker.
- [ ] Each enabled repo lists staging/production environments.
- [ ] Auto-merge toggle persists to the API.

## M10 — Notifications + deep links
- [ ] `agent.blocked` event triggers a macOS banner.
- [ ] Disabling `notify_native_desktop` on the web stops new banners within 30s.
- [ ] `robin://task/<uuid>` opens the popover at that task.
- [ ] `robin://agent/<uuid>` focuses the expanded window with the agent selected.

## M11 — Disconnected + cache
- [ ] Kill the network → overlay appears within ~5s over the last view.
- [ ] Restore network → overlay disappears, live updates resume.
- [ ] Cold start while offline renders the last snapshot for ≥ 1s.

## M12 — Distribution
- [ ] CI run on `desktop-v0.1.0` tag produces a signed DMG.
- [ ] `spctl -a -t exec` accepts the bundle (Gatekeeper).
- [ ] Updater pulls the new manifest and prompts.
- [ ] R2-hosted DMG is downloadable from the download page.

## M13 — Hardening
- [ ] Forced panic in renderer surfaces in Sentry.
- [ ] No PII or task content appears in Sentry events (spot-check 5 events).
- [ ] Telemetry breadcrumbs match the `DesktopEvent` taxonomy.

## Cross-cutting
- [ ] No console errors during the full QA pass.
- [ ] Memory stable under 300MB after 30 min idle with popover open.
- [ ] All click targets reachable by keyboard (Tab + Enter).
- [ ] Voice-over reads main controls (popover header, inbox cards, composer).
