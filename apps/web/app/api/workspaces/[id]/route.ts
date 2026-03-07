import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  mcp_config: z.record(z.string(), z.unknown()),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const { id } = await params;

  // Users can only update their own workspace
  if (id !== workspace.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only owners can update MCP config
  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ mcp_config: parsed.data.mcp_config })
    .eq("id", id);

  if (error) {
    console.error("[PATCH /api/workspaces/[id]] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
