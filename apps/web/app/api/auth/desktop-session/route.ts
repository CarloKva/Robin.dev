/**
 * Robin.dev desktop client — sign-in exchange endpoint.
 *
 * See `apps/web/lib/auth/desktop-session.ts` for the flow.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { exchangeLinkCode } from '@/lib/auth/desktop-session';

const inputSchema = z.object({
  code: z.string().min(8),
  verifier: z.string().min(32),
  state: z.string().min(1),
  device_name: z.string().nullable().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const bundle = await exchangeLinkCode({
      code: parsed.data.code,
      state: parsed.data.state,
      verifier: parsed.data.verifier,
      deviceName: parsed.data.device_name ?? null,
    });

    return NextResponse.json({
      supabase_jwt: bundle.supabaseJwt,
      refresh_token: bundle.refreshToken,
      expires_at: bundle.expiresAt,
      workspace_id: bundle.workspaceId,
      user_id: bundle.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/auth/desktop-session]', message);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
