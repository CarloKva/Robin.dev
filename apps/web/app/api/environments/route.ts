/**
 * GET  /api/environments?repositoryId= — list environments for a repository
 * POST /api/environments               — create a new environment
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import {
  getEnvironmentsForRepository,
  createEnvironment,
} from "@/lib/db/environments";
import { getRepositoriesForWorkspace } from "@/lib/db/github";

export async function GET(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repositoryId");

  if (!repositoryId) {
    return NextResponse.json({ error: "repositoryId is required" }, { status: 400 });
  }

  // Verify repository belongs to this workspace
  const repos = await getRepositoriesForWorkspace(workspace.id);
  if (!repos.some((r) => r.id === repositoryId)) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  try {
    const environments = await getEnvironmentsForRepository(repositoryId);
    return NextResponse.json({ environments });
  } catch (err) {
    console.error("[GET /api/environments] error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to fetch environments" }, { status: 500 });
  }
}

const createSchema = z.object({
  repositoryId: z.string().uuid(),
  name: z.string().min(1).max(100),
  environmentType: z.enum(["staging", "production"]),
  targetBranch: z.string().min(1).max(255),
  autoMerge: z.boolean().default(false),
});

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { repositoryId, name, environmentType, targetBranch, autoMerge } = parsed.data;

  // Guard: no auto-merge on main
  if (autoMerge && targetBranch === "main") {
    return NextResponse.json(
      { error: "Auto-merge cannot be enabled for the main branch" },
      { status: 422 }
    );
  }

  // Verify repository belongs to this workspace
  const repos = await getRepositoriesForWorkspace(workspace.id);
  if (!repos.some((r) => r.id === repositoryId)) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  try {
    const environment = await createEnvironment({
      workspaceId: workspace.id,
      repositoryId,
      name,
      environmentType,
      targetBranch,
      autoMerge,
    });
    return NextResponse.json({ environment }, { status: 201 });
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (msg.includes("workspace_environments_unique_type")) {
      return NextResponse.json(
        { error: `An environment of type '${environmentType}' already exists for this repository` },
        { status: 409 }
      );
    }
    console.error("[POST /api/environments] error:", msg);
    return NextResponse.json({ error: "Failed to create environment" }, { status: 500 });
  }
}
