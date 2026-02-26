# Auth Flow — Clerk + Supabase JWT

**Last updated:** 2026-02-26

---

## Overview

Robin.dev uses **Clerk** for user authentication and **Supabase** for the database.
These two systems are connected via a JWT bridge: Clerk issues a signed token that
Supabase validates on every request, enabling Row-Level Security to identify the caller.

---

## Full Auth Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        BROWSER                                        │
│                                                                        │
│  1. User visits any route (e.g. /dashboard)                           │
│                │                                                       │
│                ▼                                                       │
│  2. middleware.ts runs (clerkMiddleware)                               │
│     • Is route public (/sign-in, /sign-up)?  → pass through           │
│     • Otherwise: auth.protect() → redirect to /sign-in if not authed  │
│                │                                                       │
│                ▼ (user is authenticated)                               │
│  3. Server Component renders (e.g. dashboard layout)                  │
│     • auth() from @clerk/nextjs/server → { userId }                   │
│     • getWorkspaceForUser(userId) → Workspace | null                  │
│       • null? → redirect to /onboarding/workspace                     │
│       • found? → render layout with workspace name                    │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Clerk → Supabase JWT Bridge

```
Server Component / Route Handler needs DB access
│
▼
auth() from @clerk/nextjs/server
getToken({ template: "supabase" })
│
▼  Returns signed JWT:
{
  "sub": "user_abc123",        ← Clerk user ID
  "aud": "authenticated",      ← required by Supabase
  "iss": "https://[clerk-domain].clerk.accounts.dev",
  "exp": ...,
  "iat": ...
}
│
▼
createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
})
│
▼
Supabase receives request
Validates JWT against Clerk JWKS endpoint
Populates auth.jwt()->>'sub' = "user_abc123"
│
▼
RLS policy evaluates:
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = (auth.jwt()->>'sub')::text
  )
│
▼
Query returns ONLY rows belonging to the user's workspaces
```

---

## Why `auth.jwt()->>'sub'` not `auth.uid()`

Supabase's `auth.uid()` returns a `uuid`. Clerk user IDs (e.g. `user_abc123`) are **not**
valid UUIDs — they are text strings. Using `auth.uid()` would cause a cast error.

The correct approach is:
```sql
-- ✅ Correct
WHERE user_id = (auth.jwt() ->> 'sub')::text

-- ❌ Wrong — Clerk IDs are not UUIDs
WHERE user_id = auth.uid()
```

This is why `workspace_members.user_id` is `text NOT NULL`, not `uuid`.

---

## Unauthenticated Requests

```
User not signed in
│
▼
middleware.ts → auth.protect() fires
│
▼
Redirects to /sign-in
│
▼
User never reaches any Server Component that fetches data
```

If a request somehow reaches the DB layer without a valid token:
- `getToken()` returns `null`
- The Supabase client sends no `Authorization` header
- Supabase falls back to anon key
- RLS `get_my_workspace_ids()` returns empty set (no JWT `sub` claim)
- All workspace-scoped queries return 0 rows — no crash, no data leak

---

## Service Role Client (Orchestrator)

The orchestrator (`apps/orchestrator`) uses the **service role key**, not a user JWT.

```
Orchestrator (server-side, trusted)
│
▼
createClient(url, SUPABASE_SERVICE_ROLE_KEY)
│
▼
Supabase: RLS is BYPASSED
Orchestrator can read/write across ALL workspaces
```

This is intentional: the orchestrator must dispatch tasks and update agent status
across workspaces without being tied to a specific user session.

**Security contract:** the service role key is:
- Never stored in `NEXT_PUBLIC_*` variables
- Never sent to the browser
- Only used in `apps/web/lib/supabase/admin.ts` (for admin ops) and the orchestrator

---

## JWT Template Configuration (Clerk)

The Clerk JWT template named `supabase` must include:

```json
{
  "sub": "{{user.id}}",
  "aud": "authenticated"
}
```

Supabase is configured to trust Clerk's JWKS endpoint:
```
https://[your-clerk-domain].clerk.accounts.dev/.well-known/jwks.json
```

Set in: **Supabase Dashboard → Authentication → JWT Settings → Custom JWT secret (JWKS URL)**

---

## Onboarding Flow

```
New user signs up via Clerk (Google OAuth)
│
▼
Clerk creates user, redirects to NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
= /onboarding/workspace
│
▼
/onboarding/workspace page (client component)
User fills in workspace name + slug
│
▼
POST /api/workspaces
  • Validates Clerk session (auth().userId)
  • Creates workspaces row
  • Creates workspace_members row (role: owner)
  • Returns 201 or 409 (slug taken)
│
▼
router.push("/dashboard")
│
▼
(dashboard)/layout.tsx
  • getWorkspaceForUser(userId) → finds the newly created workspace
  • Renders layout with workspace name in header
```

---

## File Reference

| File | Role |
|---|---|
| `apps/web/middleware.ts` | Auth guard — protects all non-public routes |
| `apps/web/app/layout.tsx` | Wraps app with `<ClerkProvider>` |
| `apps/web/app/(dashboard)/layout.tsx` | Fetches workspace, redirects if missing |
| `apps/web/lib/supabase/server.ts` | `createSupabaseServerClient()` — user-scoped, RLS enforced |
| `apps/web/lib/supabase/admin.ts` | `createSupabaseAdminClient()` — service role, RLS bypassed |
| `apps/web/lib/db/workspace.ts` | `getWorkspaceForUser()`, `getWorkspaceById()` |
| `apps/web/app/api/workspaces/route.ts` | `POST /api/workspaces` — workspace creation |
| `supabase/migrations/0002_rls_policies.sql` | `get_my_workspace_ids()` + all RLS policies |
