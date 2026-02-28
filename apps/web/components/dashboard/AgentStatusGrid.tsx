"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AgentMiniCard } from "./AgentMiniCard";
import type { DashboardAgent } from "@/lib/db/dashboard";
import type { AgentProvisioningStatus } from "@robin/shared-types";

interface AgentStatusGridProps {
  workspaceId: string;
  initialAgents: DashboardAgent[];
}

/**
 * Real-time grid of all agents for the dashboard.
 * Re-fetches agent data whenever any agent or agent_status row changes.
 */
export function AgentStatusGrid({ workspaceId, initialAgents }: AgentStatusGridProps) {
  const [agents, setAgents] = useState<DashboardAgent[]>(initialAgents);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchAgents() {
      // 1. All agents with status (exclude deprovisioned)
      const { data: rows } = await supabase
        .from("agents_with_status")
        .select("id, name, slug, effective_status, provisioning_status, vps_ip")
        .eq("workspace_id", workspaceId)
        .neq("provisioning_status", "deprovisioned")
        .order("created_at", { ascending: true });

      if (!rows || rows.length === 0) {
        setAgents([]);
        return;
      }

      const agentIds = (rows as Array<{ id: unknown }>).map((r) => r.id as string);

      // 2. Get current_task_id + repo names in parallel
      const [statusRows, repoRows] = await Promise.all([
        supabase
          .from("agent_status")
          .select("agent_id, current_task_id")
          .in("agent_id", agentIds)
          .then(({ data }: { data: Array<{ agent_id: unknown; current_task_id: unknown }> | null }) => data ?? []),

        supabase
          .from("agent_repositories")
          .select("agent_id, repositories(full_name)")
          .in("agent_id", agentIds)
          .then(({ data }: { data: Array<{ agent_id: unknown; repositories: unknown }> | null }) => data ?? []),
      ]);

      // Build lookup maps
      const taskIdByAgent: Record<string, string | null> = {};
      for (const s of statusRows) {
        taskIdByAgent[s.agent_id as string] = (s.current_task_id as string | null) ?? null;
      }

      const repoNamesByAgent: Record<string, string[]> = {};
      for (const r of repoRows) {
        const agentId = r.agent_id as string;
        const fullName = (r.repositories as { full_name: string } | null)?.full_name;
        if (fullName) {
          (repoNamesByAgent[agentId] ??= []).push(fullName);
        }
      }

      // 3. Fetch task titles for busy agents
      const taskIds = [...new Set(Object.values(taskIdByAgent).filter((id): id is string => Boolean(id)))];
      const taskTitleById: Record<string, string> = {};
      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title")
          .in("id", taskIds);
        for (const t of (tasks ?? []) as Array<{ id: unknown; title: unknown }>) {
          taskTitleById[t.id as string] = t.title as string;
        }
      }

      setAgents(
        (rows as Array<Record<string, unknown>>).map((a) => {
          const taskId = taskIdByAgent[a["id"] as string] ?? null;
          return {
            id: a["id"] as string,
            name: a["name"] as string,
            slug: (a["slug"] as string | null) ?? null,
            effective_status: (a["effective_status"] as string) ?? "offline",
            provisioning_status: (a["provisioning_status"] as AgentProvisioningStatus) ?? "online",
            vps_ip: (a["vps_ip"] as string | null) ?? null,
            current_task_id: taskId,
            current_task_title: taskId ? (taskTitleById[taskId] ?? null) : null,
            repository_names: repoNamesByAgent[a["id"] as string] ?? [],
          };
        })
      );
    }

    const channel = supabase
      .channel(`dashboard-agents:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agents",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => void fetchAgents()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_status" },
        () => void fetchAgents()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
        <p className="text-sm font-semibold text-foreground">Nessun agente attivo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea un agente per iniziare ad eseguire task in autonomia.
        </p>
        <Link
          href="/agents"
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Gestisci agenti
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentMiniCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
