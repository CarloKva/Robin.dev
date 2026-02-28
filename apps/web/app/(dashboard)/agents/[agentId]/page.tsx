import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepositoriesForAgent } from "@/lib/db/github";
import { AgentDetailClient } from "./AgentDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return { title: `Agente ${agentId.slice(0, 8)} — Robin.dev` };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const supabase = await createSupabaseServerClient();

  // Fetch agent with provisioning fields
  const { data: agent, error } = await supabase
    .from("agents_with_status")
    .select("*")
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error || !agent) notFound();

  // Fetch repositories assigned to this agent
  const repositories = await getRepositoriesForAgent(agentId);

  // Fetch last 10 tasks handled by this agent
  const { data: recentTasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, type, created_at, updated_at")
    .eq("assigned_agent_id", agentId)
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false })
    .limit(10);

  return (
    <AgentDetailClient
      agent={agent}
      workspaceId={workspace.id}
      repositories={repositories}
      recentTasks={recentTasks ?? []}
    />
  );
}
