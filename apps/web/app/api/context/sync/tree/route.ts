import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getGitHubConnection } from "@/lib/db/github";
import { getInstallationToken } from "@/lib/github/app";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const repoFullName = searchParams.get("repoFullName");
  if (!repoFullName) {
    return NextResponse.json({ error: "repoFullName required" }, { status: 400 });
  }

  const connection = await getGitHubConnection(workspace.id);
  if (!connection) {
    return NextResponse.json({ error: "GitHub non connesso al workspace" }, { status: 422 });
  }

  let token: string;
  try {
    token = await getInstallationToken(connection.installation_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub token error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/trees/HEAD?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `GitHub ${res.status}: ${text}` }, { status: 502 });
  }

  const data = (await res.json()) as {
    tree: { path: string; type: string }[];
  };

  const paths = (data.tree ?? [])
    .filter((item) => item.type === "blob" && item.path.endsWith(".md"))
    .map((item) => item.path);

  return NextResponse.json({ paths });
}
