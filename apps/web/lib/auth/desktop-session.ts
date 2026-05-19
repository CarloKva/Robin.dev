/**
 * Robin.dev desktop client — server-side session helpers.
 *
 * Spec §3.3 / §M1. Three operations:
 *
 *   mintLinkCode({ userId, state, codeChallenge, workspaceId })
 *     Called from the Clerk-protected `/auth/desktop-handoff` Server
 *     Component after a successful sign-in. Returns the opaque link code
 *     to embed in the `robin://auth/callback` redirect.
 *
 *   exchangeLinkCode({ code, state, verifier })
 *     Called from `POST /api/auth/desktop-session`. Verifies the verifier
 *     hashes to the stored challenge, marks the row used, issues a fresh
 *     Supabase JWT + a Robin-internal refresh token, and persists the
 *     refresh token's SHA-256 in `desktop_sessions` so the desktop can
 *     roll the Supabase JWT without re-signing-in.
 *
 *   rotateSupabaseJwt({ refreshToken })
 *     Called from `POST /api/auth/desktop-session/refresh`. Verifies the
 *     refresh token, mints a new Supabase JWT, returns it.
 *
 * Supabase JWTs are signed with `SUPABASE_JWT_SECRET` (the same secret used
 * by Clerk's `supabase` template). The desktop is therefore a peer
 * authority alongside Clerk for issuing user-scoped Supabase JWTs.
 */

import { createHmac, randomBytes, createHash } from 'node:crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const SUPABASE_JWT_TTL_SECONDS = 60 * 60; // 1 hour, matches Clerk's default.

interface MintLinkCodeInput {
  userId: string;
  state: string;
  codeChallenge: string;
  workspaceId: string | null;
}

export async function mintLinkCode(input: MintLinkCodeInput): Promise<string> {
  const supabase = createSupabaseAdminClient();
  // Opportunistic purge so the table doesn't grow without bound. Supabase's
  // query builders are PromiseLike but don't expose `.catch` until awaited,
  // so wrap in try/catch instead. Missing function (e.g. migration not yet
  // applied) is non-fatal here.
  try {
    await supabase.rpc('purge_expired_desktop_link_codes');
  } catch {
    /* ignore */
  }

  // One pending handoff per PKCE `state`. Re-hitting `/auth/desktop-handoff`
  // mints another row otherwise and poll's `.maybeSingle()` errors on multiples.
  const { error: deleteErr } = await supabase
    .from('desktop_link_codes')
    .delete()
    .eq('state', input.state)
    .is('used_at', null);
  if (deleteErr) {
    throw new Error(`Failed to reset pending desktop link: ${deleteErr.message}`);
  }

  const code = randomToken(48);
  const { error } = await supabase.from('desktop_link_codes').insert({
    code,
    user_id: input.userId,
    state: input.state,
    code_challenge: input.codeChallenge,
    workspace_id: input.workspaceId,
  });
  if (error) {
    throw new Error(`Failed to mint desktop link code: ${error.message}`);
  }
  return code;
}

interface ExchangeLinkCodeInput {
  code: string;
  state: string;
  verifier: string;
  deviceName: string | null;
}

interface PollByStateInput {
  state: string;
  verifier: string;
  deviceName: string | null;
}

/**
 * Polled variant of the exchange: looks up a `desktop_link_codes` row by
 * its `state` (instead of by opaque `code`). Used by the desktop client to
 * complete sign-in without depending on `robin://` URL-scheme delivery,
 * which doesn't work reliably for raw dev binaries (only for installed
 * .app bundles).
 *
 * Returns null if no row yet — caller keeps polling. Throws on PKCE
 * mismatch or stale row.
 */
export async function pollExchangeByState(
  input: PollByStateInput,
): Promise<DesktopSessionBundle | null> {
  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from('desktop_link_codes')
    .select('code, user_id, state, code_challenge, workspace_id, expires_at, used_at')
    .eq('state', input.state)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (!row) return null;

  const linkCode = row as {
    code: string;
    user_id: string;
    state: string;
    code_challenge: string;
    workspace_id: string | null;
    expires_at: string;
    used_at: string | null;
  };

  if (new Date(linkCode.expires_at).getTime() < Date.now()) {
    throw new Error('Link code expired');
  }
  if (!verifyChallenge(input.verifier, linkCode.code_challenge)) {
    throw new Error('PKCE verifier mismatch');
  }

  await supabase
    .from('desktop_link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', linkCode.code);

  const refreshToken = randomToken(48);
  const refreshSha = sha256(refreshToken);
  await supabase.from('desktop_sessions').insert({
    user_id: linkCode.user_id,
    workspace_id: linkCode.workspace_id,
    refresh_token_sha: refreshSha,
    device_name: input.deviceName,
  });

  const { jwt, expiresAt } = signSupabaseJwt({
    sub: linkCode.user_id,
    workspaceId: linkCode.workspace_id,
  });

  return {
    supabaseJwt: jwt,
    refreshToken,
    expiresAt,
    workspaceId: linkCode.workspace_id,
    userId: linkCode.user_id,
  };
}

export interface DesktopSessionBundle {
  supabaseJwt: string;
  refreshToken: string;
  expiresAt: number;
  workspaceId: string | null;
  userId: string;
}

export async function exchangeLinkCode(
  input: ExchangeLinkCodeInput,
): Promise<DesktopSessionBundle> {
  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from('desktop_link_codes')
    .select('user_id, state, code_challenge, workspace_id, expires_at, used_at')
    .eq('code', input.code)
    .maybeSingle();

  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (!row) throw new Error('Unknown or expired link code');

  const linkCode = row as {
    user_id: string;
    state: string;
    code_challenge: string;
    workspace_id: string | null;
    expires_at: string;
    used_at: string | null;
  };

  if (linkCode.used_at) throw new Error('Link code already used');
  if (new Date(linkCode.expires_at).getTime() < Date.now()) {
    throw new Error('Link code expired');
  }
  if (linkCode.state !== input.state) throw new Error('State mismatch');
  if (!verifyChallenge(input.verifier, linkCode.code_challenge)) {
    throw new Error('PKCE verifier mismatch');
  }

  await supabase
    .from('desktop_link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', input.code);

  const refreshToken = randomToken(48);
  const refreshSha = sha256(refreshToken);
  await supabase.from('desktop_sessions').insert({
    user_id: linkCode.user_id,
    workspace_id: linkCode.workspace_id,
    refresh_token_sha: refreshSha,
    device_name: input.deviceName,
  });

  const { jwt, expiresAt } = signSupabaseJwt({
    sub: linkCode.user_id,
    workspaceId: linkCode.workspace_id,
  });

  return {
    supabaseJwt: jwt,
    refreshToken,
    expiresAt,
    workspaceId: linkCode.workspace_id,
    userId: linkCode.user_id,
  };
}

export async function rotateSupabaseJwt(
  refreshToken: string,
): Promise<{ supabaseJwt: string; expiresAt: number; workspaceId: string | null; userId: string }> {
  const supabase = createSupabaseAdminClient();
  const sha = sha256(refreshToken);
  const { data, error } = await supabase
    .from('desktop_sessions')
    .select('user_id, workspace_id, revoked_at')
    .eq('refresh_token_sha', sha)
    .maybeSingle();

  if (error) throw new Error(`Lookup failed: ${error.message}`);
  const row = data as { user_id: string; workspace_id: string | null; revoked_at: string | null } | null;
  if (!row) throw new Error('Unknown refresh token');
  if (row.revoked_at) throw new Error('Refresh token revoked');

  await supabase
    .from('desktop_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('refresh_token_sha', sha);

  const { jwt, expiresAt } = signSupabaseJwt({
    sub: row.user_id,
    workspaceId: row.workspace_id,
  });
  return { supabaseJwt: jwt, expiresAt, workspaceId: row.workspace_id, userId: row.user_id };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const sha = sha256(refreshToken);
  await supabase
    .from('desktop_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('refresh_token_sha', sha);
}

// ---------- internals -------------------------------------------------------

function randomToken(bytes: number): string {
  return base64Url(randomBytes(bytes));
}

function sha256(input: string): string {
  return base64Url(createHash('sha256').update(input).digest());
}

function verifyChallenge(verifier: string, challenge: string): boolean {
  const computed = sha256(verifier);
  return constantTimeEquals(computed, challenge);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

interface SignSupabaseJwtInput {
  sub: string;
  workspaceId: string | null;
}

interface SignedJwt {
  jwt: string;
  expiresAt: number; // epoch seconds
}

function signSupabaseJwt(input: SignSupabaseJwtInput): SignedJwt {
  const secret = process.env['SUPABASE_JWT_SECRET'];
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET not set — cannot sign desktop session');
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SUPABASE_JWT_TTL_SECONDS;
  const header = base64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        sub: input.sub,
        role: 'authenticated',
        iat: issuedAt,
        exp: expiresAt,
        iss: 'robin-desktop',
        aud: 'authenticated',
        ...(input.workspaceId ? { workspace_id: input.workspaceId } : {}),
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const signature = base64Url(createHmac('sha256', secret).update(signingInput).digest());
  return { jwt: `${signingInput}.${signature}`, expiresAt };
}
