# ADR-02: Monorepo Tooling — npm Workspaces over Turborepo

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Carlo Ferrero

---

## Context

Robin.dev has a monorepo structure with 3 packages:

- `apps/web` — Next.js frontend (gestionale)
- `apps/orchestrator` — Node.js backend service
- `packages/shared-types` — shared TypeScript types

We need to decide on the monorepo management tooling.

---

## Decision

**Use npm workspaces (built into npm 7+) as the only monorepo tool.**

No Turborepo, no Nx, no Lerna.

---

## Options Considered

### Option 1: npm Workspaces (Chosen)

Root `package.json`:
```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

**Pros:**
- Ships with npm — zero extra dependencies, no lock-in
- `npm install` from root hoists all deps and links workspace packages
- Cross-package imports work via `"@robin/shared-types": "*"` in `package.json`
- No config files, no learning curve
- `npm run -w apps/web dev` runs scripts in specific workspaces
- `concurrently` handles multi-app dev startup with a single `npm run dev`

**Cons:**
- No incremental build caching (Turborepo's main selling point)
- No dependency graph visualization
- Manual script orchestration for parallel builds

### Option 2: Turborepo

**Pros:**
- Intelligent build caching — unchanged packages skip rebuild
- Built-in pipeline configuration (`turbo.json`)
- Remote caching with Vercel integration

**Cons:**
- Additional dependency (`turbo` package)
- `turbo.json` pipeline configuration required
- Build caching has minimal impact on a 3-package repo with a solo developer
- Complexity cost outweighs benefit at this scale

### Option 3: Nx

Not considered — significantly more complex, enterprise-oriented, wrong scale.

---

## Consequences

**Positive:**
- Minimal toolchain — one tool fewer to learn, configure, and update
- Works out of the box with standard Node.js ecosystem

**Negative:**
- Full rebuilds of all packages on every CI run (acceptable at current scale)
- Must manually order build steps if packages have compile-time dependencies

**Migration path:**
If the team grows beyond 3–4 developers or packages exceed 10, evaluate Turborepo adoption. The npm workspaces structure is fully compatible — Turborepo wraps it without structural changes.

---

## Review Trigger

Revisit when CI build time for a single PR exceeds 5 minutes consistently.
