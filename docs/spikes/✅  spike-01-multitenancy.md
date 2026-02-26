# Spike 01: Multi-tenancy Architecture Analysis

**Date:** 2026-02-26
**Author:** Carlo Ferrero
**Outcome:** → ADR-01

---

## Problem Statement

Robin.dev workspaces must be strictly isolated. Users in Workspace A must never see data from Workspace B — not through bugs, not through API errors, not through edge cases.

What is the simplest, most reliable mechanism to enforce this in Supabase?

---

## Options Analyzed

### 1. Row-Level Security (RLS)

**Mechanism:**
Each row carries a `workspace_id` column. PostgreSQL RLS policies evaluate on every query:

```sql
-- Policy attached to the table
CREATE POLICY "tasks_select"
ON tasks
FOR SELECT
USING (workspace_id IN (SELECT get_my_workspace_ids()));

-- Helper resolves user → workspaces
CREATE FUNCTION get_my_workspace_ids()
RETURNS SETOF uuid AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid()::text
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

The `auth.uid()` function is populated by Supabase from the JWT in the `Authorization` header. Clerk provides this JWT via a custom template.

**Implementation with Clerk:**
1. Clerk issues a JWT with `sub: user_id` and `aud: "authenticated"`
2. Supabase validates the JWT using Clerk's JWKS endpoint
3. `auth.uid()` returns the Clerk user ID
4. `workspace_members.user_id` stores Clerk user IDs
5. RLS policies call `get_my_workspace_ids()` to resolve access

**Security properties:**
- Enforced at the database engine level — cannot be bypassed by application code
- `SECURITY DEFINER` on the helper function prevents privilege escalation
- Applies to all clients (web app, orchestrator, direct SQL connections)

**Performance:**
- `workspace_members` needs an index on `user_id`
- `workspace_id` columns need indexes on all tenant tables
- For <100 tenants with <10,000 tasks each, query overhead is negligible (<1ms)
- PostgreSQL caches the function result per transaction with `STABLE`

---

### 2. Schema-per-Tenant

**Mechanism:**
Each workspace gets a dedicated PostgreSQL schema:

```sql
CREATE SCHEMA ws_abc123;
CREATE TABLE ws_abc123.tasks (...);
```

Application sets `search_path` on connection:
```sql
SET search_path = ws_abc123;
SELECT * FROM tasks;  -- resolves to ws_abc123.tasks
```

**Problems identified:**

1. **Supabase auth breaks:** `auth.uid()` is defined in the `auth` schema. When `search_path` is changed to a tenant schema, `auth.uid()` becomes unreachable unless the path explicitly includes `auth,public,ws_abc123`. This requires custom connection management.

2. **Provisioning complexity:** Every new workspace requires a DDL transaction to create the schema and all tables. This must run synchronously during workspace signup. Migration failures leave partial schemas.

3. **Migration management:** `supabase db push` applies to the default schema only. Applying migrations to 50 tenant schemas requires a custom migration runner that loops through all schemas — a significant operational burden.

4. **Prisma incompatibility:** Prisma's datasource URL doesn't support dynamic `search_path`. Would require `prisma.$executeRaw('SET search_path = ...')` before every query block — error-prone.

5. **Supabase tooling:** The Studio UI, MCP server, and pgMeta API all operate on the `public` schema by default. Tenant data becomes invisible to these tools.

**When schema-per-tenant makes sense:**
- Compliance requirements mandating physical data separation per tenant
- Regulatory environments requiring per-tenant backup/restore
- Tenant counts >10,000 where RLS index scans become expensive

None of these apply to Robin.dev at current scale.

---

## Decision Matrix

| Criterion | RLS | Schema-per-tenant |
|-----------|-----|-------------------|
| Implementation effort | Low | High |
| Supabase auth integration | Native | Requires custom work |
| Migration management | Simple | Complex |
| Prisma compatibility | Full | Requires workarounds |
| Provisioning on signup | None | DDL transaction |
| Security isolation | Policy-level | Schema-level |
| Performance at <100 tenants | Excellent | Excellent |
| Supabase tooling support | Full | Partial |

---

## Conclusion

RLS is the correct choice for Robin.dev at this stage. The schema-per-tenant approach introduces significant complexity with no meaningful benefit at our scale.

See **ADR-01** for the formal decision record.
