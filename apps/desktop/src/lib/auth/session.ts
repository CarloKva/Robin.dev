/**
 * Renderer-side session shim.
 *
 * The Rust crate (`apps/desktop/src-tauri/src/auth.rs`) owns the Keychain
 * storage. This module:
 *  - Generates PKCE state, persists `{state→verifier}` in tauri-plugin-store
 *  - Opens the system browser at the configured sign-in URL
 *  - Handles the `robin://auth/callback?state=…&code=…` deep-link event by
 *    POSTing to `/api/auth/desktop-session`
 *  - Stores the resulting bundle in macOS Keychain via Rust IPC
 *  - Rotates the Supabase JWT against `/api/auth/desktop-session/refresh`
 */

import { challengeFor, generatePkce, type PendingPkce } from './pkce';
import { API_BASE_URL } from '@/lib/api/client';
import { applySession } from '@/lib/supabase/client';

const TAURI_AVAILABLE = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const PENDING_STORE = 'pending-pkce.json';
const PENDING_KEY = 'pending';

export interface DesktopSession {
  supabaseJwt: string;
  refreshToken: string;
  expiresAt: number;
  workspaceId: string | null;
  userId: string;
}

interface ExchangeResponseBody {
  supabase_jwt: string;
  refresh_token: string;
  expires_at: number;
  workspace_id: string | null;
  user_id: string;
}

interface RefreshResponseBody {
  supabase_jwt: string;
  expires_at: number;
  workspace_id: string | null;
  user_id: string;
}

async function invokeRust<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!TAURI_AVAILABLE) {
    throw new Error(`Tauri IPC unavailable (cmd=${cmd}) — running in browser dev?`);
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function loadSession(): Promise<DesktopSession | null> {
  if (!TAURI_AVAILABLE) {
    try {
      const raw = window.localStorage.getItem('robin-session');
      return raw ? (JSON.parse(raw) as DesktopSession) : null;
    } catch {
      return null;
    }
  }
  try {
    const raw = await invokeRust<{
      supabase_jwt: string;
      refresh_token: string;
      expires_at: number;
      workspace_id: string | null;
      user_id: string;
    } | null>('cmd_load_session');
    if (!raw) return null;
    return {
      supabaseJwt: raw.supabase_jwt,
      refreshToken: raw.refresh_token,
      expiresAt: raw.expires_at,
      workspaceId: raw.workspace_id,
      userId: raw.user_id,
    };
  } catch (err) {
    console.warn('loadSession failed', err);
    return null;
  }
}

async function persistSession(session: DesktopSession): Promise<void> {
  if (!TAURI_AVAILABLE) {
    window.localStorage.setItem('robin-session', JSON.stringify(session));
    return;
  }
  await invokeRust('cmd_store_session', {
    payload: {
      supabase_jwt: session.supabaseJwt,
      refresh_token: session.refreshToken,
      expires_at: session.expiresAt,
      workspace_id: session.workspaceId,
      user_id: session.userId,
    },
  });
}

export async function clearSession(): Promise<void> {
  const current = await loadSession();
  if (current) {
    await fetch(`${API_BASE_URL}/api/auth/desktop-session/refresh`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${current.refreshToken}` },
    }).catch(() => undefined);
  }
  if (!TAURI_AVAILABLE) {
    window.localStorage.removeItem('robin-session');
    return;
  }
  await invokeRust('cmd_clear_session');
}

export async function startSignIn(): Promise<DesktopSession> {
  const baseSignInUrl = import.meta.env['VITE_SIGN_IN_URL'];
  if (typeof baseSignInUrl !== 'string' || !baseSignInUrl) {
    throw new Error('VITE_SIGN_IN_URL missing');
  }

  const pkce = await generatePkce();
  await stashPending(pkce);

  const challenge = await challengeFor(pkce.verifier);
  const url = new URL(baseSignInUrl);
  const handoff = new URL('/auth/desktop-handoff', API_BASE_URL);
  handoff.searchParams.set('state', pkce.state);
  handoff.searchParams.set('code_challenge', challenge);
  handoff.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('redirect_url', handoff.toString());

  if (TAURI_AVAILABLE) {
    await invokeRust('cmd_open_url', { url: url.toString() });
  } else {
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  // Poll until the handoff page mints the link code. Sidesteps `robin://`
  // delivery, which requires a registered .app bundle on macOS.
  return pollUntilSignedIn(pkce.state, pkce.verifier);
}

async function pollUntilSignedIn(
  state: string,
  verifier: string,
): Promise<DesktopSession> {
  const deadline = Date.now() + 5 * 60_000;
  const intervalMs = 2000;

  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE_URL}/api/auth/desktop-session/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, verifier, device_name: hostname() }),
    });

    if (res.status === 202) {
      await sleep(intervalMs);
      continue;
    }
    if (!res.ok) {
      const body = await safeJson(res);
      throw new Error(`Sign-in failed: ${res.status} ${describe(body)}`);
    }
    const body = (await res.json()) as ExchangeResponseBody & { status?: string };
    if (body.status && body.status !== 'ready') {
      await sleep(intervalMs);
      continue;
    }
    const session: DesktopSession = {
      supabaseJwt: body.supabase_jwt,
      refreshToken: body.refresh_token,
      expiresAt: body.expires_at,
      workspaceId: body.workspace_id,
      userId: body.user_id,
    };
    await persistSession(session);
    await applySession(session);
    await clearPending();
    return session;
  }
  throw new Error('Sign-in timed out — please try again');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CallbackPayload {
  state: string;
  code: string;
}

export async function completeSignIn(payload: CallbackPayload): Promise<DesktopSession> {
  const pending = await readPending();
  if (!pending || pending.state !== payload.state) {
    throw new Error('Unknown sign-in state — aborting');
  }
  const res = await fetch(`${API_BASE_URL}/api/auth/desktop-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: payload.state,
      code: payload.code,
      verifier: pending.verifier,
      device_name: hostname(),
    }),
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`Exchange failed: ${res.status} ${describe(body)}`);
  }
  const body = (await res.json()) as ExchangeResponseBody;
  const session: DesktopSession = {
    supabaseJwt: body.supabase_jwt,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_at,
    workspaceId: body.workspace_id,
    userId: body.user_id,
  };
  await persistSession(session);
  await applySession(session);
  await clearPending();
  return session;
}

export async function refreshSession(current: DesktopSession): Promise<DesktopSession> {
  const res = await fetch(`${API_BASE_URL}/api/auth/desktop-session/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${current.refreshToken}` },
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`Refresh failed: ${res.status} ${describe(body)}`);
  }
  const body = (await res.json()) as RefreshResponseBody;
  const next: DesktopSession = {
    ...current,
    supabaseJwt: body.supabase_jwt,
    expiresAt: body.expires_at,
    workspaceId: body.workspace_id,
    userId: body.user_id,
  };
  await persistSession(next);
  await applySession(next);
  return next;
}

export function isSessionFresh(session: DesktopSession | null): boolean {
  if (!session) return false;
  const skew = 60_000;
  return session.expiresAt * 1000 > Date.now() + skew;
}

// ---------- internals -----------------------------------------------------

async function stashPending(pkce: PendingPkce): Promise<void> {
  if (!TAURI_AVAILABLE) {
    window.localStorage.setItem('robin-pending-pkce', JSON.stringify(pkce));
    return;
  }
  const { load } = await import('@tauri-apps/plugin-store');
  const store = await load(PENDING_STORE, { autoSave: false, defaults: {} });
  await store.set(PENDING_KEY, pkce);
  await store.save();
}

async function readPending(): Promise<PendingPkce | null> {
  if (!TAURI_AVAILABLE) {
    try {
      const raw = window.localStorage.getItem('robin-pending-pkce');
      return raw ? (JSON.parse(raw) as PendingPkce) : null;
    } catch {
      return null;
    }
  }
  const { load } = await import('@tauri-apps/plugin-store');
  const store = await load(PENDING_STORE, { autoSave: false, defaults: {} });
  return (await store.get<PendingPkce>(PENDING_KEY)) ?? null;
}

async function clearPending(): Promise<void> {
  if (!TAURI_AVAILABLE) {
    window.localStorage.removeItem('robin-pending-pkce');
    return;
  }
  const { load } = await import('@tauri-apps/plugin-store');
  const store = await load(PENDING_STORE, { autoSave: false, defaults: {} });
  await store.delete(PENDING_KEY);
  await store.save();
}

function hostname(): string {
  try {
    if (typeof navigator !== 'undefined' && 'userAgent' in navigator) {
      return navigator.userAgent.slice(0, 200);
    }
  } catch {
    /* ignore */
  }
  return 'Robin desktop';
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function describe(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    return String((body as { error: unknown }).error);
  }
  return '';
}
