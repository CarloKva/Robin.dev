/**
 * PATCH /api/maintenance/configs/[configId]
 *
 * Workspace-owner-only update of a maintenance capability config: enable
 * state, schedule, budget, spec_paths, protected_paths, auto-implement
 * settings, bug noise allowlist.
 *
 * Triage actions and Run Now have their own routes — this one is just
 * settings.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import {
  getCapabilityConfig,
  updateCapabilityConfig,
  type CapabilityConfigPatch,
} from "@/lib/db/maintenance";

const weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const scheduleSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("always_on"), interval_minutes: z.number().int().min(5).max(1440) }),
  z.object({
    mode: z.literal("windows"),
    interval_minutes: z.number().int().min(5).max(1440),
    windows: z
      .array(z.object({ weekday, start: time, end: time }))
      .min(1)
      .max(14),
  }),
  z.object({ mode: z.literal("disabled") }),
]);

const patchSchema = z
  .object({
    enabled: z.boolean(),
    schedule: scheduleSchema,
    daily_token_budget: z.number().int().min(1).max(50_000_000),
    per_run_token_cap: z.number().int().min(1).max(50_000_000),
    auto_implement: z.boolean(),
    auto_implement_min_confidence: z.number().min(0).max(1).nullable(),
    protected_paths: z.array(z.string().min(1).max(500)).max(50),
    spec_paths: z.array(z.string().min(1).max(500)).max(20),
    bug_noise_allowlist: z.array(z.string().min(1).max(500)).max(200),
    bug_source_config: z.record(z.string(), z.unknown()),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Empty patch");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json(
      { error: "Solo il proprietario del workspace può modificare le capability." },
      { status: 403 }
    );
  }

  const { configId } = await params;
  const existing = await getCapabilityConfig(workspace.id, configId);
  if (!existing) {
    return NextResponse.json({ error: "Config non trovata" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // If the user is disabling, clear next_run_at so the scheduler skips it
  // until they re-enable. If enabling and no next_run_at, schedule now-ish.
  // exactOptionalPropertyTypes: omit undefined keys, don't pass them through.
  const patch: CapabilityConfigPatch = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = value;
    }
  }
  if (parsed.data.enabled === false) {
    patch.next_run_at = null;
  } else if (parsed.data.enabled === true && !existing.next_run_at) {
    const jitterMinutes = Math.floor(Math.random() * 5);
    patch.next_run_at = new Date(Date.now() + jitterMinutes * 60_000).toISOString();
  }

  try {
    const updated = await updateCapabilityConfig(workspace.id, configId, patch);
    return NextResponse.json({ config: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
