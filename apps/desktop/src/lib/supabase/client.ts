/**
 * Supabase client for the desktop renderer.
 *
 * Mirrors `apps/web/lib/supabase/client.ts` but pulls the JWT from the
 * Keychain-resident session rather than Clerk's browser SDK. Caller is
 * responsible for refreshing the token before it expires; see
 * `lib/auth/session.ts:isSessionFresh`.
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { DesktopSession } from '@/lib/auth/session';

const URL = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const ANON_KEY = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

if (!URL || !ANON_KEY) {
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — Supabase client will fail at runtime.',
  );
}

let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(URL ?? '', ANON_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return cached;
}

export async function applySession(session: DesktopSession | null): Promise<void> {
  const client = supabase();
  if (session) {
    client.realtime.setAuth(session.supabaseJwt);
    await client.auth.setSession({
      access_token: session.supabaseJwt,
      refresh_token: 'desktop',
    });
  } else {
    client.realtime.setAuth(ANON_KEY ?? '');
  }
}
