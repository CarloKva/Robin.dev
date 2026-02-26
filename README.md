# Robin.dev

AI-powered development task management. Assign tasks to AI agents, review their work, and ship faster.

---

## Getting Started

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- A [Clerk](https://clerk.com) application
- A Supabase project (`ccgodxlviculeqsnlgse`)

### 1. Clone & install

```bash
git clone https://github.com/CarloKva/Robin.dev.git
cd Robin.dev
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your actual keys:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role |
| `DATABASE_URL` | Supabase Dashboard → Settings → Database → Connection String → URI (add `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Same connection string **without** the pgbouncer params (for Prisma migrations) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |

### 3. Configure Clerk

1. Clerk Dashboard → **JWT Templates** → New → select **Supabase** preset
2. Confirm template name is `supabase`
3. Copy the **JWKS URL** from the JWT template page

### 4. Configure Supabase JWT

1. Supabase Dashboard → **Authentication** → **JWT Settings**
2. Select **Use a custom JWT secret**
3. Paste the Clerk JWKS URL → Save

### 5. Push database schema

```bash
supabase link --project-ref ccgodxlviculeqsnlgse
supabase db push
```

### 6. Generate Prisma client

```bash
npx prisma generate
```

### 7. Run in development

```bash
npm run dev
```

This starts both the Next.js web app (`http://localhost:3000`) and the orchestrator in parallel.

---

## Project Structure

```
Robin.dev/
├── apps/
│   ├── web/               # Next.js 15 App Router (Clerk + Supabase)
│   └── orchestrator/      # Node.js task orchestration service (Sprint 2)
├── packages/
│   └── shared-types/      # TypeScript types shared between apps
├── prisma/
│   └── schema.prisma      # Prisma ORM schema
├── supabase/
│   ├── config.toml        # Supabase CLI config
│   ├── migrations/        # SQL migration files
│   └── seed.sql           # Dev seed data
└── .github/workflows/     # CI pipeline (lint + typecheck)
```

---

## Manual Steps (Production Setup)

After getting the app running locally:

1. **Clerk Dashboard** → Create application → enable Google OAuth → set redirect URLs:
   - After sign-in → `/dashboard`
   - After sign-up → `/onboarding/workspace`

2. **Vercel** → [kva-projects](https://vercel.com/kva-projects) → Import Git Repository → set root directory to `apps/web`

3. **GitHub** → Settings → Branches → add branch protection on `main` (require PR + passing status checks)

4. **GitHub** → Settings → Secrets → add all env vars from `.env.example`

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start web + orchestrator in parallel |
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run build` | Build all workspaces |

---

## End-to-End Verification

1. Open incognito browser → navigate to app → should redirect to `/sign-in`
2. Sign up as new user with Google
3. Should redirect to `/onboarding/workspace`
4. Create workspace (name + slug)
5. Should redirect to `/dashboard` showing workspace name in header
6. Navigate to `/settings` → shows real data from Supabase
7. Logout → redirect to `/sign-in`
