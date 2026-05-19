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

let warned = false;
function ensureConfigured(): boolean {
  if (URL && ANON_KEY) return true;
  if (!warned) {
    console.warn(
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — Supabase calls are no-ops. Fill in apps/desktop/.env.local and restart `npm run dev`.',
    );
    warned = true;
  }
  return false;
}

let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (cached) return cached;
  if (!ensureConfigured()) {
    // Build a client pointed at a placeholder so calling code can still
    // dispatch — every query will return an error which our hooks already
    // tolerate.
    cached = createClient('https://placeholder.invalid', 'placeholder', {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 1 } },
    });
    return cached;
  }
  cached = createClient(URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return cached;
}

export async function applySession(session: DesktopSession | null): Promise<void> {
  if (!ensureConfigured()) return;
  const client = supabase();
  if (session) {
    client.realtime.setAuth(session.supabaseJwt);
    await client.auth.setSession({
      access_token: session.supabaseJwt,
      refresh_token: 'desktop',
    });
  } else {
    client.realtime.setAuth(ANON_KEY!);
  }
}
