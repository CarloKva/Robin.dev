import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using the service role key.
 * RLS is BYPASSED — this client sees all data across all workspaces.
 *
 * SECURITY: Never expose this to the browser.
 * - Never use in Client Components
 * - Never assign to a NEXT_PUBLIC_ variable
 * - Only use in trusted server-side contexts (Route Handlers, Server Actions, Orchestrator)
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
