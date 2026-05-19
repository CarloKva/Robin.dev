/**
 * Typed REST client used by both popover and expanded views to talk to the
 * Vercel-hosted Route Handlers (`apps/web/app/api/*`).
 *
 * Pulls the JWT from the Keychain-backed session (see `lib/auth/session.ts`).
 * Every helper throws on non-2xx so callers can use try/catch flow.
 */

import { loadSession } from '@/lib/auth/session';

export const API_BASE_URL: string =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? 'https://app.robin.dev';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = await loadSession();
  const headers = new Headers(init.headers);
  // For REST calls we present the Supabase JWT — the desktop-aware variant of
  // `requireWorkspace` (TODO M1+) accepts either Clerk session or this JWT.
  // Realtime channels use `supabase.realtime.setAuth(jwt)` separately.
  if (session) headers.set('Authorization', `Bearer ${session.supabaseJwt}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    throw new ApiError(
      typeof body === 'object' && body && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : res.statusText,
      res.status,
      body,
    );
  }
  return body as T;
}
