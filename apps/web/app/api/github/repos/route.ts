/**
 * GET /api/github/repos
 *
 * Returns repositories accessible via the GitHub App installation,
 * merged with the workspace's enabled/disabled status from the DB.
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getGitHubConnection, getRepositoriesForWorkspace } from "@/lib/db/github";
import { listInstallationRepos } from "@/lib/github/app";

export async function GET() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const connection = await getGitHubConnection(workspace.id);
  if (!connection) {
    return NextResponse.json(
      { error: "GitHub non connesso", code: "GITHUB_NOT_CONNECTED" },
      { status: 404 }
    );
  }

  try {
    const [githubRepos, dbRepos] = await Promise.all([
      listInstallationRepos(connection.installation_id),
      getRepositoriesForWorkspace(workspace.id),
    ]);

    const dbRepoMap = new Map(dbRepos.map((r) => [r.github_repo_id, r]));

    const repos = githubRepos.map((gr) => {
      const dbRepo = dbRepoMap.get(gr.id);
      return {
        github_repo_id: gr.id,
        full_name: gr.full_name,
        default_branch: gr.default_branch,
        is_private: gr.private,
        description: gr.description,
        updated_at: gr.updated_at,
        // From DB — null if not yet enabled
        db_id: dbRepo?.id ?? null,
        is_enabled: dbRepo?.is_enabled ?? false,
        is_available: dbRepo?.is_available ?? true,
      };
    });

    return NextResponse.json({ repos });
  } catch (err) {
    console.error("[GET /api/github/repos]", err);
    return NextResponse.json(
      { error: "Impossibile recuperare i repository da GitHub" },
      { status: 500 }
    );
  }
}
