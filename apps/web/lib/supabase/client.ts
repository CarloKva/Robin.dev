import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase singleton.
 * Used in Client Components for Realtime subscriptions.
 *
 * Authentication: set the Clerk JWT via `supabase.realtime.setAuth(token)`
 * before subscribing to channels, so RLS policies apply.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!
  );
}

// Singleton instance — one client per browser session
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }
  return browserClient;
}
