import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

/**
 * User-scoped Supabase client for Server Components and Route Handlers.
 * Attaches the Clerk JWT so RLS policies can identify the current user.
 * RLS is ENFORCED — the user only sees rows within their workspaces.
 */
export async function createSupabaseServerClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });

  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}
