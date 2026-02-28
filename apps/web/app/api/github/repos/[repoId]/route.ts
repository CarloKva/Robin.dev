/**
 * DELETE /api/github/repos/[repoId]
 * Soft-disables a repository (is_enabled = false).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { disableRepository } from "@/lib/db/github";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { repoId } = await params;

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace non trovato" }, { status: 404 });

  try {
    await disableRepository(repoId, workspace.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/github/repos/[repoId]]", err);
    return NextResponse.json({ error: "Impossibile disabilitare il repository" }, { status: 500 });
  }
}
