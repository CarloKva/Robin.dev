/**
 * Robin.dev desktop client — polling exchange.
 *
 * The desktop opens the system browser at `/auth/desktop-handoff`, which
 * mints a row in `desktop_link_codes` keyed by the PKCE state. Rather than
 * waiting for a `robin://auth/callback` URL handoff (which requires a
 * registered .app bundle), the desktop polls this endpoint with the same
 * state until the row exists, then completes the exchange.
 *
 * Status code semantics:
 *   202 — no row yet, keep polling
 *   200 — row found, returns the session bundle (single-use)
 *   401 — PKCE mismatch or stale row
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { desktopAuthPreflight, withDesktopAuthCors } from '@/lib/api/desktop-session-cors';
import { pollExchangeByState } from '@/lib/auth/desktop-session';

const inputSchema = z.object({
  state: z.string().min(1),
  verifier: z.string().min(32),
  device_name: z.string().nullable().optional(),
});

export function OPTIONS(): NextResponse {
  return desktopAuthPreflight();
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return withDesktopAuthCors(
      NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      ),
    );
  }

  try {
    const bundle = await pollExchangeByState({
      state: parsed.data.state,
      verifier: parsed.data.verifier,
      deviceName: parsed.data.device_name ?? null,
    });
    if (!bundle) {
      return withDesktopAuthCors(NextResponse.json({ status: 'pending' }, { status: 202 }));
    }
    return withDesktopAuthCors(
      NextResponse.json({
        status: 'ready',
        supabase_jwt: bundle.supabaseJwt,
        refresh_token: bundle.refreshToken,
        expires_at: bundle.expiresAt,
        workspace_id: bundle.workspaceId,
        user_id: bundle.userId,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/auth/desktop-session/poll]', message);
    return withDesktopAuthCors(NextResponse.json({ error: message }, { status: 401 }));
  }
}
