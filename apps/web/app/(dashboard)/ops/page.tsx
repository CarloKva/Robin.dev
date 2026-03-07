import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser, getWorkspaceMemberRole } from "@/lib/db/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OpsPanel } from "./OpsPanel";
import type { OpsRun } from "@robin/shared-types";

function mapRow(row: Record<string, unknown>): OpsRun {
  return {
    id: row["id"] as string,
    workspaceId: (row["workspace_id"] as string | null) ?? null,
    triggeredByUserId: row["triggered_by_user_id"] as string,
    scope: row["scope"] as OpsRun["scope"],
    status: row["status"] as OpsRun["status"],
    progress: (row["progress"] as number) ?? 0,
    log: (row["log"] as OpsRun["log"]) ?? [],
    rawDiagnostics: (row["raw_diagnostics"] as OpsRun["rawDiagnostics"]) ?? null,
    aiAnalysis: (row["ai_analysis"] as string | null) ?? null,
    aiRecommendations:
      (row["ai_recommendations"] as OpsRun["aiRecommendations"]) ?? null,
    actionsTaken: (row["actions_taken"] as OpsRun["actionsTaken"]) ?? [],
    createdAt: row["created_at"] as string,
    completedAt: (row["completed_at"] as string | null) ?? null,
  };
}

export default async function OpsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") redirect("/dashboard");

  const supabase = createSupabaseAdminClient();

  // Fetch latest run (running or completed)
  const { data } = await supabase
    .from("ops_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const initialRun = data ? mapRow(data as Record<string, unknown>) : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-6">
        <h1 className="text-sm font-semibold">Ops Diagnostics</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <OpsPanel initialRun={initialRun} />
      </div>
    </div>
  );
}
