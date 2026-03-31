---
name: nextjs-prisma-stack
description: Conventions and patterns for Next.js App Router + Prisma + Vitest projects. Auto-activates when working in such a codebase.
autoActivate: true
triggers:
  filePatterns: ["*.tsx", "*.ts", "prisma/schema.prisma", "vitest.config.*", "next.config.*"]
  keywords: [nextjs, prisma, vitest, app router, server component, server action, api route]
---

# Next.js + Prisma + Vitest Stack Conventions

When working in a codebase with this stack, follow these conventions:

## Next.js App Router
- Server Components are the default — don't add "use client" unless the component needs interactivity
- Server Actions go in files with "use server" at the top or inline with the `"use server"` directive
- API routes live in `app/api/` using route.ts files with exported GET/POST/PUT/DELETE/PATCH functions
- Always validate request bodies with zod in API routes
- Use `NextResponse.json()` for API responses, always include appropriate status codes
- Handle errors with try/catch in API routes — never let unhandled errors reach the client

## Prisma
- The Prisma client should be instantiated as a singleton (check for existing `lib/prisma.ts` or `lib/db.ts`)
- Always use transactions for multi-step database operations
- Use `select` or `include` explicitly — avoid fetching all fields when not needed
- Check for existing Prisma error handling patterns (P2002 for unique violations, P2025 for not found, etc.)
- NEVER modify `prisma/schema.prisma` during a bugfix unless the bug IS a schema issue
- NEVER run `prisma migrate` or `prisma db push` — that's a human decision

## Vitest
- Test files follow the pattern: `*.test.ts` or `*.test.tsx` colocated with source or in `__tests__/`
- Use `describe` / `it` blocks
- Mock Prisma client using vi.mock or a shared test utility if one exists
- In route tests, test the route handler function directly
- Run tests with: `npx vitest run` (single run) or check package.json scripts

## TypeScript
- The project uses strict TypeScript — all types must be explicit, no `any`
- Check `tsconfig.json` for path aliases (commonly `@/` for `src/`)
- Use Zod for runtime validation, TypeScript types for compile-time safety

## General
- Check the project's CLAUDE.md or README.md first for project-specific conventions
- Check existing code patterns before inventing new ones
- Respect the existing code style (formatting, naming, file structure)
