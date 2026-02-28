/**
 * POST /api/auth/github/detect
 *
 * Fallback for when the GitHub App installation callback redirect fails.
 * Lists all installations of the GitHub App via the App JWT, finds any
 * that are NOT already linked to a workspace, and links the most recent
 * unlinked installation to the current user's workspace.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getGitHubConnection, upsertGitHubConnection } from "@/lib/db/github";
import { listAppInstallations } from "@/lib/github/app";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace non trovato" }, { status: 404 });
  }

  const existing = await getGitHubConnection(workspace.id);
  if (existing) {
    return NextResponse.json({
      ok: true,
      already_connected: true,
      account: existing.github_account_login,
    });
  }

  try {
    const installations = await listAppInstallations();

    if (installations.length === 0) {
      return NextResponse.json(
        { error: "no_installations", message: "Nessuna installazione trovata. Installa prima la GitHub App." },
        { status: 404 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: linkedRows } = await admin
      .from("github_connections")
      .select("installation_id")
      .eq("status", "connected");

    const linkedIds = new Set(
      (linkedRows ?? []).map((r: { installation_id: number }) => r.installation_id)
    );

    const unlinked = installations
      .filter((inst) => !linkedIds.has(inst.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const target = unlinked[0];
    if (!target) {
      return NextResponse.json(
        { error: "all_linked", message: "Tutte le installazioni sono già collegate a un workspace." },
        { status: 404 }
      );
    }

    await upsertGitHubConnection({
      workspaceId: workspace.id,
      installationId: target.id,
      githubAccountId: target.account.id,
      githubAccountLogin: target.account.login,
      githubAccountType: target.account.type,
    });

    return NextResponse.json({
      ok: true,
      account: target.account.login,
      installation_id: target.id,
    });
  } catch (err) {
    console.error("[POST /api/auth/github/detect]", err);
    return NextResponse.json(
      { error: "detection_failed", message: "Impossibile rilevare l'installazione GitHub." },
      { status: 500 }
    );
  }
}
