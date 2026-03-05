import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getGitHubConnection } from "@/lib/db/github";
import { getInstallationToken } from "@/lib/github/app";

/**
 * GET /api/repositories/[repoId]/check
 *
 * Preflight check: verifies that the GitHub App installation still has
 * access to the repository. Called from the task creation form when the
 * user selects a repository before submitting.
 *
 * Returns { accessible: true, full_name, clone_url } on success,
 *         { accessible: false, error } on failure.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { repoId } = await params;

  const supabase = await createSupabaseServerClient();

  // Load the repository record
  const { data: repo, error: repoError } = await supabase
    .from("repositories")
    .select("id, full_name, default_branch, is_private")
    .eq("id", repoId)
    .eq("workspace_id", workspace.id)
    .single();

  if (repoError || !repo) {
    return NextResponse.json({ accessible: false, error: "Repository not found" }, { status: 404 });
  }

  // Load the GitHub App connection
  const connection = await getGitHubConnection(workspace.id);
  if (!connection) {
    return NextResponse.json(
      { accessible: false, error: "GitHub App non connessa. Vai in Settings → GitHub per connetterla." },
      { status: 422 }
    );
  }

  // Call GitHub API to verify access
  try {
    const token = await getInstallationToken(connection.installation_id);
    const res = await fetch(`https://api.github.com/repos/${repo.full_name}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      const msg = res.status === 404
        ? "Repository non trovata o non accessibile con questa installazione GitHub App."
        : `GitHub API ha risposto con ${res.status}.`;
      return NextResponse.json({ accessible: false, error: msg });
    }

    const cloneUrl = `https://x-access-token:${token}@github.com/${repo.full_name}.git`;

    return NextResponse.json({
      accessible: true,
      full_name: repo.full_name,
      default_branch: repo.default_branch,
      clone_url: cloneUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { accessible: false, error: `Errore verifica accesso: ${String(err)}` },
      { status: 500 }
    );
  }
}
