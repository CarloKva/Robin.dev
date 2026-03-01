import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getWorkspaceSettings, upsertWorkspaceSettings } from "@/lib/db/workspace-settings";

const settingsSchema = z.object({
  notify_email: z.string().email().nullable().optional(),
  notify_slack_webhook: z.string().url().nullable().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const settings = await getWorkspaceSettings(workspace.id);
  return NextResponse.json({ settings: settings ?? { workspace_id: workspace.id, notify_email: null, notify_slack_webhook: null } });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const updates: Record<string, string | null> = {};
  if (parsed.data.notify_email !== undefined) updates["notify_email"] = parsed.data.notify_email;
  if (parsed.data.notify_slack_webhook !== undefined) updates["notify_slack_webhook"] = parsed.data.notify_slack_webhook;

  const settings = await upsertWorkspaceSettings(workspace.id, updates);
  if (!settings) return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });

  return NextResponse.json({ settings });
}
