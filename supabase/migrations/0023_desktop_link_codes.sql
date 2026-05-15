-- Robin.dev desktop client — one-time link codes for the system-browser
-- sign-in handoff (spec §3.3 / §M1).
--
-- Flow:
--   1. Desktop opens system browser at /auth/desktop-handoff with PKCE state.
--   2. Page is Clerk-protected; on auth it inserts a row here keyed by an
--      opaque `code`, storing the user_id and the SHA-256 code_challenge.
--   3. The page redirects to `robin://auth/callback?state=…&code=…`.
--   4. Desktop hits POST /api/auth/desktop-session with `{ state, code, verifier }`.
--      The handler verifies the verifier hashes to the stored challenge,
--      marks the row used, and returns the session bundle.
--
-- Rows expire 5 minutes after creation and are single-use.

CREATE TABLE IF NOT EXISTS public.desktop_link_codes (
  code              text PRIMARY KEY,
  user_id           text NOT NULL,
  state             text NOT NULL,
  code_challenge    text NOT NULL,
  workspace_id      uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  used_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desktop_link_codes_user_id_idx
  ON public.desktop_link_codes (user_id);

-- Purge expired rows opportunistically — a daily cron could do this too,
-- but the surface area is tiny so cleanup-on-write is enough.
CREATE OR REPLACE FUNCTION public.purge_expired_desktop_link_codes()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.desktop_link_codes WHERE expires_at < now() - interval '1 hour';
$$;

-- RLS: nobody reads this table directly. Only the desktop-session route
-- handlers touch it, via the service-role client.
ALTER TABLE public.desktop_link_codes ENABLE ROW LEVEL SECURITY;
-- (no policies => no user can SELECT)


-- Long-lived desktop sessions. Stores the Robin-internal refresh token so the
-- desktop can roll its Supabase JWT every ~50 minutes without re-signing-in.
-- The token itself is hashed at rest (sha256) and revealed to the client
-- once at exchange time, mirroring how Stripe stores secret keys.
CREATE TABLE IF NOT EXISTS public.desktop_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL,
  workspace_id      uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  refresh_token_sha text NOT NULL UNIQUE,
  device_name       text,
  last_used_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz
);

CREATE INDEX IF NOT EXISTS desktop_sessions_user_id_idx
  ON public.desktop_sessions (user_id);

ALTER TABLE public.desktop_sessions ENABLE ROW LEVEL SECURITY;
-- (no policies => admin-only access via service role)
