/**
 * Single source of truth for whether we have a healthy connection to
 * Supabase Realtime. Every realtime hook reports here so the disconnected
 * overlay (M11) can flip in one place.
 */

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

type Listener = (state: ConnectionState) => void;

class ConnectionStateStore {
  private state: ConnectionState = 'connecting';
  private listeners = new Set<Listener>();

  get(): ConnectionState {
    return this.state;
  }

  set(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const fn of this.listeners) fn(next);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const connectionStateStore = new ConnectionStateStore();
