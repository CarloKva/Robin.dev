/**
 * Per-view JSON snapshots. Used to show the last known state on cold-start
 * before Realtime catches up, and to keep the popover non-empty when the
 * disconnected overlay is up.
 */

const FILE = 'view-snapshots.json';

let cached: Record<string, unknown> = {};
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (isTauri()) {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load(FILE, { autoSave: false });
      const value = await store.get<Record<string, unknown>>('snapshots');
      cached = value ?? {};
      loaded = true;
      return;
    } catch (err) {
      console.warn('snapshots load (tauri) failed', err);
    }
  }
  try {
    const raw = window.localStorage.getItem('robin-view-snapshots');
    cached = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    cached = {};
  }
  loaded = true;
}

export async function readSnapshot<T>(key: string): Promise<T | null> {
  await ensureLoaded();
  return (cached[key] as T | undefined) ?? null;
}

export async function writeSnapshot(key: string, value: unknown): Promise<void> {
  await ensureLoaded();
  cached[key] = value;
  if (isTauri()) {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load(FILE, { autoSave: false });
      await store.set('snapshots', cached);
      await store.save();
      return;
    } catch (err) {
      console.warn('snapshots persist (tauri) failed', err);
    }
  }
  try {
    window.localStorage.setItem('robin-view-snapshots', JSON.stringify(cached));
  } catch {
    /* ignore */
  }
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
