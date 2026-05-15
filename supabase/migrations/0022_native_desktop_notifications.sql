-- Robin.dev desktop client — per-workspace preference for native macOS
-- notifications. Defaulting true matches the founder recommendation in
-- docs/desktop-implementation-plan.md §Open question C.11.

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS notify_native_desktop boolean NOT NULL DEFAULT true;

-- No corresponding API change here — the existing
-- `apps/web/app/api/workspace/settings/route.ts` route surfaces the
-- whole row; the new column will be returned automatically.
