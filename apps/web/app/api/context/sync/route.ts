import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getGitHubConnection } from "@/lib/db/github";
import { getInstallationToken } from "@/lib/github/app";
import { upsertContextDocumentFromGitHub } from "@/lib/db/context";

const syncSchema = z.object({
  repoFullName: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1).max(500),
});

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const body = await request.json().catch(() => null);
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { repoFullName, paths } = parsed.data;

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

  const results: { path: string; ok: boolean; error?: string }[] = [];

  for (const path of paths) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repoFullName}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!res.ok) {
        results.push({ path, ok: false, error: `GitHub ${res.status}` });
        continue;
      }

      const data = (await res.json()) as { content: string; sha: string; name: string };
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const title = data.name.replace(/\.md$/i, "").replace(/[-_]/g, " ");

      await upsertContextDocumentFromGitHub(workspace.id, {
        title,
        content,
        source_repo_full_name: repoFullName,
        source_path: path,
        source_sha: data.sha,
      });

      results.push({ path, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      results.push({ path, ok: false, error: message });
    }
  }

  return NextResponse.json({ results });
}
