/**
 * GET  /api/auth/github  — redirect to GitHub App installation page
 * DELETE /api/auth/github — disconnect GitHub App from workspace
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getGitHubConnection, revokeGitHubConnection } from "@/lib/db/github";
import { getGitHubAppInstallUrl } from "@/lib/github/app";
import { getAgentsForWorkspace } from "@/lib/db/agents";

// GET — redirect to GitHub App installation flow
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const installUrl = getGitHubAppInstallUrl();
    return NextResponse.redirect(installUrl);
  } catch (err) {
    console.error("[GET /api/auth/github]", err);
    return NextResponse.json(
      { error: "GitHub App non configurata — contatta il supporto" },
      { status: 500 }
    );
  }
}

// DELETE — disconnect GitHub App from workspace
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace non trovato" }, { status: 404 });

  const connection = await getGitHubConnection(workspace.id);
  if (!connection) {
    return NextResponse.json({ error: "Nessuna connessione GitHub attiva" }, { status: 404 });
  }

  // Block disconnection if there are active agents
  const agents = await getAgentsForWorkspace(workspace.id);
  const activeAgents = agents.filter(
    (a) => a.effective_status === "idle" || a.effective_status === "busy"
  );
  if (activeAgents.length > 0) {
    return NextResponse.json(
      {
        error: "Impossibile disconnettere GitHub: ci sono agenti attivi",
        agents: activeAgents.map((a) => ({ id: a.id, name: a.name })),
      },
      { status: 409 }
    );
  }

  await revokeGitHubConnection(workspace.id);
  return NextResponse.json({ ok: true });
}
