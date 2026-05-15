import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  clearSession,
  completeSignIn,
  isSessionFresh,
  loadSession,
  refreshSession,
  type DesktopSession,
} from '@/lib/auth/session';
import { applySession } from '@/lib/supabase/client';
import { connectionStateStore, type ConnectionState } from '@/lib/realtime/connectionState';

interface SessionContextValue {
  session: DesktopSession | null;
  loading: boolean;
  connection: ConnectionState;
  signOut: () => Promise<void>;
}

const Context = createContext<SessionContextValue | null>(null);

const REFRESH_LEAD_SECONDS = 5 * 60; // refresh 5 min before expiry

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DesktopSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ConnectionState>(connectionStateStore.get());

  // Initial load + Supabase Realtime auth handoff.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await loadSession();
      if (cancelled) return;
      if (s && !isSessionFresh(s)) {
        try {
          const fresh = await refreshSession(s);
          if (!cancelled) {
            setSession(fresh);
            await applySession(fresh);
          }
        } catch {
          if (!cancelled) {
            setSession(null);
          }
        }
      } else {
        setSession(s);
        await applySession(s);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tail the connection state store.
  useEffect(() => connectionStateStore.subscribe(setConnection), []);

  // Listen for sign-out from tray menu.
  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
    await applySession(null);
  }, []);

  useEffect(() => {
    const handler = () => {
      void signOut();
    };
    window.addEventListener('robin:sign-out', handler);
    return () => window.removeEventListener('robin:sign-out', handler);
  }, [signOut]);

  // Listen for the deep-link auth callback.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ state: string; code: string }>).detail;
      if (!detail) return;
      void completeSignIn(detail)
        .then(async (fresh) => {
          setSession(fresh);
          await applySession(fresh);
        })
        .catch((err) => {
          console.error('completeSignIn failed', err);
        });
    };
    window.addEventListener('robin:auth-callback', handler);
    return () => window.removeEventListener('robin:auth-callback', handler);
  }, []);

  // Schedule the next refresh.
  useEffect(() => {
    if (!session) return;
    const msUntilRefresh = Math.max(
      30_000,
      session.expiresAt * 1000 - Date.now() - REFRESH_LEAD_SECONDS * 1000,
    );
    const id = window.setTimeout(() => {
      void refreshSession(session)
        .then(async (fresh) => {
          setSession(fresh);
          await applySession(fresh);
        })
        .catch((err) => {
          console.warn('refreshSession failed — signing out', err);
          void signOut();
        });
    }, msUntilRefresh);
    return () => window.clearTimeout(id);
  }, [session, signOut]);

  const value = useMemo<SessionContextValue>(
    () => ({ session, loading, connection, signOut }),
    [session, loading, connection, signOut],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

export function useWorkspaceId(): string | null {
  const { session } = useSession();
  return session?.workspaceId ?? null;
}
