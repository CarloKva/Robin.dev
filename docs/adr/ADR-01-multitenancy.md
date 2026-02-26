# ADR-01: Multi-tenancy Strategy — RLS over Separate Schemas

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Carlo Ferrero

---

## Context

Robin.dev is a multi-tenant SaaS platform where each workspace (team) must be strictly isolated from others. We need to decide how to implement tenant isolation at the database layer using Supabase/PostgreSQL.

Two primary options were evaluated:

1. **Shared schema with Row-Level Security (RLS)**
2. **Separate schema per tenant** (schema-per-tenant)

---

## Decision

**Use a shared schema with Row-Level Security (RLS) on all tenant tables.**

All tables include a `workspace_id` column. Supabase RLS policies restrict every query using `auth.uid()` resolved against a `workspace_members` lookup.

---

## Options Considered

### Option 1: Shared Schema + RLS (Chosen)

- All tenants share the same tables
- Each row has `workspace_id UUID NOT NULL`
- RLS policies filter using `auth.uid()` via a helper function `get_my_workspace_ids()`
- Supabase's auth integration works natively

**Pros:**
- Supabase auth (`auth.uid()`) integrates natively — no custom plumbing
- Zero provisioning overhead — no schema creation on workspace signup
- Standard migrations apply to all tenants simultaneously
- Supabase dashboard, Studio, and MCP tools work out of the box
- Prisma works with standard `DATABASE_URL` without schema switching

**Cons:**
- Large cross-tenant table scans possible at very high tenant count (mitigated by indexes on `workspace_id`)
- A misconfigured RLS policy could leak data across tenants (mitigated by testing and policy audits)

### Option 2: Separate Schema per Tenant

- Each workspace gets its own PostgreSQL schema (e.g., `ws_abc123.tasks`)
- Queries use `SET search_path = ws_abc123`

**Pros:**
- Physical isolation between tenants
- Can restore/backup per-tenant independently

**Cons:**
- Supabase auth integration breaks — `auth.uid()` lives in the `auth` schema; custom `search_path` management required
- Schema creation must run on every workspace signup — provisioning logic in application code
- Migrations must be applied to every schema individually — no `supabase db push` for all tenants
- Prisma requires dynamic datasource URLs or connection string switching
- Supabase Studio and MCP only show one schema easily
- At <100 tenants, operational complexity vastly outweighs isolation benefits

---

## Consequences

**Positive:**
- Rapid development — no provisioning logic needed
- Schema migrations are simple `supabase db push` commands
- Auth just works with Clerk JWT → Supabase RLS pattern

**Negative:**
- RLS must be enabled on every tenant table — a missing policy is a security bug
- Performance must be monitored at scale; indexes on `workspace_id` are mandatory

**Mitigations:**
- Policy tests in migration files assert correct behavior
- CI checks that RLS is enabled on all tenant tables
- `workspace_id` indexes created in migration `0001`

---

## Review Trigger

Revisit this decision if tenant count exceeds 1,000 or if a compliance requirement (e.g., GDPR data residency) mandates physical isolation per tenant.
