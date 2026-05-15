/**
 * POST /api/maintenance/findings/[type]/[id]/triage
 *
 * Workspace-owner-only triage action on a spec_findings or bug_findings row.
 * Accepted actions: approve | reject | snooze | mark_implemented.
 *
 * Phase 2 step A: this route only updates triage_state and emits
 * finding.triaged. Task creation + spec_impl/bug_impl enqueue on approve
 * lands when Phase 3 ships the implementation runners.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { triageFinding, type FindingType } from "@/lib/db/maintenance";

const triageBodySchema = z
  .object({
    action: z.enum(["approve", "reject", "snooze", "mark_implemented"]),
    note: z.string().max(2000).nullable().optional(),
    snoozed_until: z
      .string()
      .datetime({ message: "snoozed_until must be ISO-8601" })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "snooze" && !value.snoozed_until) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snoozed_until"],
        message: "snoozed_until is required when action is snooze",
      });
    }
    if (
      value.action === "snooze" &&
      value.snoozed_until &&
      new Date(value.snoozed_until).getTime() <= Date.now()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snoozed_until"],
        message: "snoozed_until must be in the future",
      });
    }
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json(
      { error: "Solo il proprietario del workspace può triage le findings." },
      { status: 403 }
    );
  }

  const { type, id } = await params;
  if (type !== "spec" && type !== "bug") {
    return NextResponse.json(
      { error: "type must be 'spec' or 'bug'" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = triageBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const finding = await triageFinding({
      workspaceId: workspace.id,
      type: type as FindingType,
      findingId: id,
      patch: {
        action: parsed.data.action,
        ...(parsed.data.note !== undefined && { note: parsed.data.note }),
        ...(parsed.data.snoozed_until !== undefined && {
          snoozedUntil: parsed.data.snoozed_until,
        }),
      },
      triagedBy: userId,
    });

    if (!finding) {
      return NextResponse.json({ error: "Finding non trovata" }, { status: 404 });
    }

    return NextResponse.json({ finding });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[triage route]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
