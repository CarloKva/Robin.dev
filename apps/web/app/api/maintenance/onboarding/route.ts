/**
 * POST /api/maintenance/onboarding
 *
 * Workspace-owner-only opt-in into the maintenance feature. Flips
 * workspaces.maintenance_enabled = true so the scheduler will start picking
 * up due capability configs.
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json(
      { error: "Solo il proprietario può attivare maintenance sul workspace." },
      { status: 403 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ maintenance_enabled: true, updated_at: new Date().toISOString() })
    .eq("id", workspace.id);
  if (error) {
    console.error("[maintenance onboarding]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ maintenance_enabled: true });
}

export async function DELETE() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json(
      { error: "Solo il proprietario può disattivare maintenance sul workspace." },
      { status: 403 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ maintenance_enabled: false, updated_at: new Date().toISOString() })
    .eq("id", workspace.id);
  if (error) {
    console.error("[maintenance onboarding delete]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ maintenance_enabled: false });
}
