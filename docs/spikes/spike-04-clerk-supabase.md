# Spike 04: Clerk + Supabase JWT Integration

**Date:** 2026-02-26
**Author:** Carlo Ferrero

---

## Problem Statement

Robin.dev uses Clerk for authentication (user signup, login, session management) and Supabase for the database. Supabase RLS policies use `auth.uid()` to identify the current user. How do we connect these two systems so that:

1. Clerk manages the user session
2. Supabase knows which Clerk user is making the database request
3. RLS policies correctly filter rows for that user

---

## The JWT Bridge

### How Supabase auth works

Supabase validates a JWT on every request. If valid, it populates the `auth.uid()` function with the `sub` claim from the JWT. The JWT must:
- Be signed by a trusted key (Supabase's own auth OR a custom JWKS endpoint)
- Have `aud: "authenticated"` (Supabase rejects tokens with wrong audience)
- Have a valid `sub` claim (the user's identity)

### How Clerk fits in

Clerk can issue JWTs with custom claims via **JWT Templates**. We configure a template named `supabase` that:
1. Sets `sub` to `{{user.id}}` (the Clerk user ID)
2. Sets `aud` to `"authenticated"` (required by Supabase)

Supabase is configured to trust Clerk's JWKS endpoint:
```
https://[your-clerk-domain].clerk.accounts.dev/.well-known/jwks.json
```

This is set in the Supabase dashboard under Authentication → JWT Settings → "Use a custom JWT secret" (JWKS URL mode).

---

## Flow Diagram

```
Browser (Next.js App Router)
│
├─ User session managed by Clerk
│
├─ Server Component / Route Handler needs DB access
│     │
│     ▼
│  auth() from @clerk/nextjs/server
│  getToken({ template: "supabase" })
│     │
│     ▼  Returns signed JWT:
│     {
│       "sub": "user_abc123",
│       "aud": "authenticated",
│       "iss": "https://[clerk-domain].clerk.accounts.dev",
│       "exp": ...,
│       "iat": ...
│     }
│
├─ createClient() with Authorization: Bearer <jwt>
│     │
│     ▼
│  Supabase receives request
│  Validates JWT against Clerk JWKS
│  Populates auth.uid() = "user_abc123"
│
├─ RLS policy evaluates:
│     workspace_id IN (
│       SELECT workspace_id FROM workspace_members
│       WHERE user_id = auth.uid()::text
│     )
│
└─ Query returns only rows for user's workspaces
```

---

## Client Types

### 1. Server Client (user-scoped, RLS enforced)

```typescript
// apps/web/lib/supabase/server.ts
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export async function createSupabaseServerClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}
```

Use in: Server Components, Route Handlers, Server Actions
RLS: **enforced** — user sees only their workspace data

### 2. Service Role Client (admin, bypasses RLS)

```typescript
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

Use in: Orchestrator service, admin operations, system-level tasks
RLS: **bypassed** — sees all data
⚠️ Never expose this client to the browser. The service role key must never be in `NEXT_PUBLIC_*` variables.

---

## Manual Configuration Steps (Clerk Dashboard)

1. Go to **Clerk Dashboard** → **JWT Templates**
2. Click **New template** → Select **Supabase** (pre-built template)
3. Verify template name is `supabase`
4. Confirm claims:
   ```json
   {
     "sub": "{{user.id}}",
     "aud": "authenticated"
   }
   ```
5. Copy the **Signing key** (JWKS URL)

## Manual Configuration Steps (Supabase Dashboard)

1. Go to **Supabase Dashboard** → **Authentication** → **JWT Settings**
2. Under "JWT Secret", select **Use a custom JWT secret**
3. Paste the Clerk JWKS URL
4. Save

---

## Edge Cases

### Token expiry
Clerk tokens expire (default: 60 seconds). `getToken()` automatically refreshes from Clerk's session. No manual refresh logic needed.

### Unauthenticated requests
If `getToken()` returns `null` (user not signed in), the Supabase client will use the anon key without an Authorization header. RLS policies will deny all workspace-scoped queries. The middleware redirects unauthenticated users to `/sign-in` before they reach any data-fetching code.

### Orchestrator service authentication
The orchestrator uses the service role client. It doesn't go through Clerk. RLS is bypassed intentionally — the orchestrator is a trusted internal service that must access data across workspaces.

---

## Conclusion

The Clerk → JWT → Supabase RLS integration is a well-supported pattern with Supabase's official Clerk integration template. The key insight is that Supabase doesn't need to know about Clerk directly — it only needs to validate the JWT, which Clerk signs with its private key.
