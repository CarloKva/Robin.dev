/**
 * Robin.dev desktop client — Supabase JWT refresh.
 *
 * The desktop sends `Authorization: Bearer <refresh_token>` every ~50min;
 * we mint a fresh Supabase JWT from `desktop_sessions`. DELETE on the same
 * path revokes the refresh token (sign-out).
 */

import { NextResponse } from 'next/server';

import { desktopAuthPreflight, withDesktopAuthCors } from '@/lib/api/desktop-session-cors';
import { revokeRefreshToken, rotateSupabaseJwt } from '@/lib/auth/desktop-session';

export function OPTIONS(): NextResponse {
  return desktopAuthPreflight();
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return withDesktopAuthCors(NextResponse.json({ error: 'Missing bearer token' }, { status: 401 }));
  }
  const refreshToken = auth.slice('Bearer '.length).trim();
  if (!refreshToken) {
    return withDesktopAuthCors(NextResponse.json({ error: 'Empty bearer token' }, { status: 401 }));
  }

  try {
    const next = await rotateSupabaseJwt(refreshToken);
    return withDesktopAuthCors(
      NextResponse.json({
        supabase_jwt: next.supabaseJwt,
        expires_at: next.expiresAt,
        workspace_id: next.workspaceId,
        user_id: next.userId,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/auth/desktop-session/refresh]', message);
    return withDesktopAuthCors(NextResponse.json({ error: message }, { status: 401 }));
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return withDesktopAuthCors(NextResponse.json({ error: 'Missing bearer token' }, { status: 401 }));
  }
  await revokeRefreshToken(auth.slice('Bearer '.length).trim()).catch(() => undefined);
  return withDesktopAuthCors(NextResponse.json({ ok: true }));
}
