# ADR-03: CI/CD Strategy — GitHub Actions + Vercel Native Integration

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Carlo Ferrero

---

## Context

Robin.dev needs a CI/CD pipeline that:
1. Runs quality checks on every PR and push to `main`
2. Deploys preview environments per PR
3. Deploys production on merge to `main`

---

## Decision

**Split responsibilities:**
- **GitHub Actions** handles quality gates: lint + typecheck (parallel jobs)
- **Vercel native GitHub integration** handles all deployments (preview + production)

No custom deployment steps in GitHub Actions.

---

## Rationale

### GitHub Actions for Quality Gates

- Lint and typecheck are language-level checks — they belong in CI, not in a deploy pipeline
- Running them in GitHub Actions blocks merges to `main` before code reaches Vercel
- Both jobs run in parallel (independent, no cross-dependency) for fast feedback
- Cache `~/.npm` between runs to speed up `npm ci`

### Vercel for Deployments

Vercel's GitHub integration provides:
- **Preview deployments** — every PR gets a unique URL automatically
- **Production deployment** — every merge to `main` triggers a production build
- **Build logs** — in Vercel dashboard, not buried in GitHub Actions
- **Rollback** — one click in Vercel dashboard

Doing deployments in GitHub Actions would require:
- Vercel CLI token as a GitHub secret
- Custom deploy scripts
- Manual preview URL management
- Duplicated configuration

---

## Pipeline Overview

```
Push / PR opened
       │
       ├─── GitHub Actions ───────────────────────────────┐
       │      │                     │                      │
       │    [lint]             [typecheck]                 │
       │      │                     │                      │
       │    (pass/fail)          (pass/fail)               │
       │                                                   │
       └─── Vercel integration ────────────────────────────┤
              │                                            │
           [build]                                         │
              │                                            │
    ┌─────────┴─────────┐                                  │
    │                   │                                  │
 [PR] → preview URL   [main] → production deploy           │
                                                           │
  Branch protection on main requires GH Actions pass ──────┘
```

---

## Environments

| Environment | Trigger | URL |
|-------------|---------|-----|
| Local | `npm run dev` | `localhost:3000` |
| Preview | PR opened/updated | `*.vercel.app` (per PR) |
| Production | Merge to `main` | Custom domain |

---

## GitHub Secrets Required

The following secrets must be set in the repository for CI to work:
- None needed for lint/typecheck (only `npm ci` + run scripts)
- Vercel reads its own secrets from its GitHub App installation

For integration tests (future sprint):
- `DATABASE_URL` — Supabase connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk public key

---

## Consequences

**Positive:**
- Zero config for deployments — Vercel handles it
- Fast feedback loop: lint + typecheck typically complete in <90 seconds
- Preview URLs for every PR without any custom scripting

**Negative:**
- Deployment logs are split between GitHub and Vercel dashboards
- Cannot easily trigger conditional deployments from GitHub Actions

---

## Review Trigger

Revisit if we need database migration CI, integration tests, or staging environments that require custom deployment scripting.
