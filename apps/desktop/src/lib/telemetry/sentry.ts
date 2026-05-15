/**
 * Sentry init for the renderer.
 *
 * Lazy-loaded so dev builds without `VITE_SENTRY_DSN` set don't pay any
 * bundle cost. The Rust side will eventually do the same via the
 * `sentry-rust` crate; not wired yet — see `apps/desktop/QA.md`.
 *
 * Privacy posture: scrub anything that might contain user content. We don't
 * carry chat messages, task descriptions, or letter bodies into events.
 */

const TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let initPromise: Promise<void> | null = null;

export function initSentry(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const dsn = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;
    if (!dsn) {
      console.info('[telemetry] VITE_SENTRY_DSN missing — Sentry disabled');
      return;
    }
    const Sentry = await import('@sentry/browser').catch(() => null);
    if (!Sentry) {
      console.warn('[telemetry] @sentry/browser not installed — Sentry disabled');
      return;
    }
    Sentry.init({
      dsn,
      release: import.meta.env['VITE_APP_VERSION'] ?? '0.0.0',
      environment: TAURI ? 'desktop' : 'desktop-dev',
      tracesSampleRate: 0.05,
      beforeSend(event) {
        // Strip request/extra fields that might contain user content.
        if (event.request) delete event.request.data;
        if (event.extra) delete event.extra['payload'];
        return event;
      },
    });
  })();
  return initPromise;
}

export async function reportError(err: unknown, context?: Record<string, unknown>): Promise<void> {
  console.error('[telemetry] error', err, context);
  const dsn = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;
  if (!dsn) return;
  const Sentry = await import('@sentry/browser').catch(() => null);
  if (!Sentry) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
