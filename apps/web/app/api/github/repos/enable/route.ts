/**
 * POST /api/github/repos/enable
 * Body: { github_repo_id, full_name, default_branch, is_private }
 * Enables a repository for use with Robin.dev agents.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getGitHubConnection, enableRepository } from "@/lib/db/github";

const schema = z.object({
  github_repo_id: z.number().int().positive(),
  full_name: z.string().min(1).max(200),
  default_branch: z.string().min(1).max(100).default("main"),
  is_private: z.boolean(),
});

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const connection = await getGitHubConnection(workspace.id);
  if (!connection) {
    return NextResponse.json(
      { error: "GitHub non connesso", code: "GITHUB_NOT_CONNECTED" },
      { status: 400 }
    );
  }

  try {
    const repo = await enableRepository({
      workspaceId: workspace.id,
      githubRepoId: parsed.data.github_repo_id,
      fullName: parsed.data.full_name,
      defaultBranch: parsed.data.default_branch,
      isPrivate: parsed.data.is_private,
    });

    return NextResponse.json({ repo }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/github/repos/enable]", err);
    return NextResponse.json({ error: "Impossibile abilitare il repository" }, { status: 500 });
  }
}
