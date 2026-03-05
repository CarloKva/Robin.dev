import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import type { Workspace } from "@robin/shared-types";

export type RequireWorkspaceSuccess = { userId: string; workspace: Workspace };

/**
 * Centralized auth guard for API route handlers.
 *
 * Usage:
 *   const result = await requireWorkspace();
 *   if (result instanceof NextResponse) return result;
 *   const { userId, workspace } = result;
 */
export async function requireWorkspace(): Promise<RequireWorkspaceSuccess | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return { userId, workspace };
}
