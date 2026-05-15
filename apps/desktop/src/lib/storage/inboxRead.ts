/**
 * Per-user persistent map of `taskId → readAt epoch ms`.
 *
 * Backed by `tauri-plugin-store` when available, falling back to localStorage
 * for dev/browser. We don't sync to the server in v1 — the inbox "read" state
 * is intentionally a local notion (same as macOS Mail's badge counts).
 */

const FILE = 'inbox-read.json';
const KEY = 'map';

type ReadMap = Record<string, number>;

let cached: ReadMap | null = null;

async function load(): Promise<ReadMap> {
  if (cached) return cached;
  if (isTauri()) {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load(FILE, { autoSave: false });
      const value = await store.get<ReadMap>(KEY);
      cached = value ?? {};
      return cached;
    } catch (err) {
      console.warn('inboxRead load (tauri) failed', err);
    }
  }
  try {
    const raw = window.localStorage.getItem('robin-inbox-read');
    cached = raw ? (JSON.parse(raw) as ReadMap) : {};
  } catch {
    cached = {};
  }
  return cached;
}

export async function getInboxReadMap(): Promise<ReadMap> {
  return load();
}

export async function markRead(taskId: string, when: number = Date.now()): Promise<void> {
  const map = await load();
  map[taskId] = when;
  cached = map;
  await persist(map);
}

export async function markAllRead(taskIds: string[], when: number = Date.now()): Promise<void> {
  const map = await load();
  for (const id of taskIds) map[id] = when;
  cached = map;
  await persist(map);
}

async function persist(map: ReadMap): Promise<void> {
  if (isTauri()) {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load(FILE, { autoSave: false });
      await store.set(KEY, map);
      await store.save();
      return;
    } catch (err) {
      console.warn('inboxRead persist (tauri) failed', err);
    }
  }
  try {
    window.localStorage.setItem('robin-inbox-read', JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
