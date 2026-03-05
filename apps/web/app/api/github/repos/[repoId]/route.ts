/**
 * DELETE /api/github/repos/[repoId]
 * Soft-disables a repository (is_enabled = false).
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { disableRepository } from "@/lib/db/github";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { repoId } = await params;

  try {
    await disableRepository(repoId, workspace.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/github/repos/[repoId]]", err);
    return NextResponse.json({ error: "Impossibile disabilitare il repository" }, { status: 500 });
  }
}
