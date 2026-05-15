/**
 * Minimal telemetry event taxonomy for the desktop client.
 *
 * Rules (mirror the privacy posture in `lib/telemetry/sentry.ts`):
 *   - No user content (chat messages, task descriptions, letter bodies, repo names).
 *   - No PII beyond the Clerk user id, which is already in the session.
 *   - Counters and durations only.
 *
 * Wired to Sentry breadcrumbs in dev; in prod we'd point this at a tiny
 * `/api/telemetry` endpoint, but that's not built yet — keep it local until
 * the founder confirms the dashboard (§Open question C.14).
 */

const TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export type DesktopEvent =
  | { name: 'desktop.launched'; props: { firstRun: boolean } }
  | { name: 'desktop.signed_in'; props: { durationMs: number } }
  | { name: 'desktop.signed_out'; props: Record<string, never> }
  | { name: 'desktop.popover_toggled'; props: { source: 'tray' | 'shortcut' } }
  | { name: 'desktop.inbox_letter_copied'; props: { kind: string } }
  | { name: 'desktop.inbox_marked_all_read'; props: { count: number } }
  | { name: 'desktop.expanded_opened'; props: { trigger: 'popover' | 'deeplink' } }
  | { name: 'desktop.chat_sent'; props: { agentHue: number } }
  | { name: 'desktop.notification_clicked'; props: { eventType: string } }
  | { name: 'desktop.session_refresh_failed'; props: { status: number } };

export function track(event: DesktopEvent): void {
  if (!TAURI) {
    console.debug('[telemetry]', event.name, event.props);
    return;
  }
  void recordBreadcrumb(event);
}

async function recordBreadcrumb(event: DesktopEvent): Promise<void> {
  const dsn = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;
  if (!dsn) return;
  const Sentry = await import('@sentry/browser').catch(() => null);
  if (!Sentry) return;
  Sentry.addBreadcrumb({
    category: 'desktop',
    message: event.name,
    level: 'info',
    data: event.props as Record<string, unknown>,
  });
}
