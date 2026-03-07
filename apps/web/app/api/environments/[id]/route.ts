/**
 * PATCH  /api/environments/[id] — update an environment
 * DELETE /api/environments/[id] — delete an environment
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import {
  getEnvironmentById,
  updateEnvironment,
  deleteEnvironment,
} from "@/lib/db/environments";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetBranch: z.string().min(1).max(255).optional(),
  autoMerge: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { id } = await params;

  const existing = await getEnvironmentById(id, workspace.id);
  if (!existing) {
    return NextResponse.json({ error: "Environment not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, targetBranch, autoMerge } = parsed.data;

  // Guard: no auto-merge on main
  const resolvedTargetBranch = targetBranch ?? existing.target_branch;
  const resolvedAutoMerge = autoMerge ?? existing.auto_merge;
  if (resolvedAutoMerge && resolvedTargetBranch === "main") {
    return NextResponse.json(
      { error: "Auto-merge cannot be enabled for the main branch" },
      { status: 422 }
    );
  }

  try {
    const updated = await updateEnvironment(id, workspace.id, {
      ...(name !== undefined && { name }),
      ...(targetBranch !== undefined && { targetBranch }),
      ...(autoMerge !== undefined && { autoMerge }),
    });
    return NextResponse.json({ environment: updated });
  } catch (err) {
    console.error("[PATCH /api/environments/[id]] error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to update environment" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { id } = await params;

  const existing = await getEnvironmentById(id, workspace.id);
  if (!existing) {
    return NextResponse.json({ error: "Environment not found" }, { status: 404 });
  }

  try {
    await deleteEnvironment(id, workspace.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/environments/[id]] error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to delete environment" }, { status: 500 });
  }
}
