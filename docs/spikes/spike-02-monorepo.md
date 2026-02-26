# Spike 02: Monorepo Tooling Analysis

**Date:** 2026-02-26
**Author:** Carlo Ferrero
**Outcome:** → ADR-02

---

## Problem Statement

Robin.dev has 3 co-evolving packages that share types and must be developed locally in tandem. What's the minimum viable monorepo tooling that supports:
- Shared TypeScript types across packages
- Single `npm install` at root
- Single `npm run dev` that starts all services
- CI that runs lint and typecheck for all packages

---

## Package Structure

```
Robin.dev/
├── apps/
│   ├── web/          # Next.js (React frontend)
│   └── orchestrator/ # Node.js (agent coordination service)
└── packages/
    └── shared-types/ # Shared TypeScript types
```

Cross-package dependency:
- `apps/web` imports from `@robin/shared-types`
- `apps/orchestrator` imports from `@robin/shared-types`

---

## Options Analyzed

### 1. npm Workspaces (Chosen)

**Setup:**
```json
// package.json (root)
{
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w apps/web\" \"npm run dev -w apps/orchestrator\"",
    "build": "npm run build -w packages/shared-types && npm run build -w apps/web",
    "typecheck": "tsc -b",
    "lint": "eslint ."
  }
}
```

**How cross-package imports work:**
```json
// apps/web/package.json
{
  "dependencies": {
    "@robin/shared-types": "*"
  }
}
```

npm symlinks `packages/shared-types` into `node_modules/@robin/shared-types`. TypeScript resolves it via `tsconfig.json` path aliases or `composite` project references.

**`npm install` behavior:**
- Run once at root
- All packages' dependencies hoisted to `node_modules/` at root
- Shared deps (e.g., TypeScript) deduplicated automatically

**Running a single package:**
```bash
npm run dev -w apps/web      # web only
npm run dev -w apps/orchestrator  # orchestrator only
```

**CI:**
`npm ci` at root installs all packages. Then `npm run lint` and `npm run typecheck` run across all packages from a single command.

---

### 2. Turborepo

**What it adds over npm workspaces:**
- `turbo.json` pipeline: defines task dependencies (e.g., `build` depends on `^build` of upstream packages)
- Build caching: skips tasks if inputs haven't changed (uses content hash)
- Remote caching: share cache between developer machines and CI (via Vercel Remote Cache)
- `turbo run dev` replaces `concurrently`

**Actual benefit at our scale:**

| Scenario | npm workspaces | Turborepo |
|----------|---------------|-----------|
| `npm run build` (nothing changed) | Rebuilds all | Skips all (cache hit) |
| `npm run build` (shared-types changed) | Rebuilds all | Rebuilds only dependents |
| `npm run typecheck` | ~15s | ~15s (no cache for type checks) |
| `npm run lint` | ~10s | ~10s (cache sometimes helps) |

With 3 packages and a solo developer:
- Full `npm run build` takes <30 seconds total
- Turborepo cache saves maybe 20 seconds per run
- Setup cost: `npm install turbo`, create `turbo.json`, learn pipeline syntax

**Verdict:** The cache benefit is real but the cost/benefit ratio is poor at this scale.

---

### 3. Nx

**What it adds:**
- Project graph visualization
- Affected-task detection (only run tests for changed packages)
- Code generators for scaffolding
- Distributed task execution

**Verdict:** Massively over-engineered for 3 packages. Not evaluated further.

---

### 4. pnpm Workspaces

pnpm improves on npm with:
- Faster installs (content-addressable store)
- Stricter dependency resolution (no phantom dependencies)
- Native workspace protocol: `"@robin/shared-types": "workspace:*"`

**Verdict:** pnpm is a valid choice and slightly better than npm at this scale. However, it requires installing pnpm globally and changing CI setup. npm workspaces is sufficient and has zero additional tooling requirements.

---

## Conclusion

npm workspaces provides everything Robin.dev needs with zero additional dependencies. The monorepo structure is fully compatible with Turborepo if we need to migrate in the future.

See **ADR-02** for the formal decision record.
