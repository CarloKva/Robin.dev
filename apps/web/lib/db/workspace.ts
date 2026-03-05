import { prisma } from "@/lib/prisma";
import type { Workspace } from "@robin/shared-types";

/**
 * Fetch the first workspace a user belongs to.
 * Returns null if the user has no workspace yet (→ redirect to /onboarding/workspace).
 */
export async function getWorkspaceForUser(userId: string): Promise<Workspace | null> {
  try {
    const member = await prisma.workspace_members.findFirst({
      where: { user_id: userId },
      include: { workspaces: true },
    });

    if (!member) return null;

    const ws = member.workspaces;
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      created_at: ws.created_at.toISOString(),
      updated_at: ws.updated_at.toISOString(),
    };
  } catch (error) {
    console.error("[getWorkspaceForUser]", error);
    return null;
  }
}

/**
 * Returns the role of a user in their workspace, or null if not a member.
 */
export async function getWorkspaceMemberRole(userId: string): Promise<string | null> {
  try {
    const member = await prisma.workspace_members.findFirst({
      where: { user_id: userId },
      select: { role: true },
    });
    return member?.role ?? null;
  } catch (error) {
    console.error("[getWorkspaceMemberRole]", error);
    return null;
  }
}

/**
 * Update the name of a workspace.
 */
export async function updateWorkspaceName(workspaceId: string, name: string): Promise<Workspace | null> {
  try {
    const ws = await prisma.workspaces.update({
      where: { id: workspaceId },
      data: { name, updated_at: new Date() },
    });
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      created_at: ws.created_at.toISOString(),
      updated_at: ws.updated_at.toISOString(),
    };
  } catch (error) {
    console.error("[updateWorkspaceName]", error);
    return null;
  }
}

/**
 * Fetch a workspace by its ID.
 * Used in the dashboard layout and settings page.
 */
export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  try {
    const ws = await prisma.workspaces.findUnique({
      where: { id },
    });

    if (!ws) return null;

    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      created_at: ws.created_at.toISOString(),
      updated_at: ws.updated_at.toISOString(),
    };
  } catch (error) {
    console.error("[getWorkspaceById]", error);
    return null;
  }
}
