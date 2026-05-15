/**
 * Display formatters shared across dashboard components.
 *
 * Locale is Italian to match the rest of the UI copy. Both formatters are
 * tolerant: they swallow Invalid Date and NaN cases and fall back to the
 * original input so they never blow up a render.
 */

export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function formatRelativeIt(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return iso;
    const diffSec = Math.max(0, Math.round((now - then) / 1000));
    if (diffSec < 60) return `${diffSec}s fa`;
    const min = Math.round(diffSec / 60);
    if (min < 60) return `${min}m fa`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h fa`;
    const d = Math.round(h / 24);
    return `${d}g fa`;
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return iso;
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
