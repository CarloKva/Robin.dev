import type { AgentStatusEnum } from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

export class AgentRepository {
  private get db() {
    return getSupabaseClient();
  }

  async setStatus(
    agentId: string,
    status: AgentStatusEnum,
    currentTaskId?: string | null
  ): Promise<void> {
    const { error } = await this.db
      .from("agent_status")
      .upsert(
        {
          agent_id: agentId,
          status,
          current_task_id: currentTaskId ?? null,
          last_heartbeat: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agent_id" }
      );

    if (error) {
      // Non-fatal: agent status update failure should not break job processing
      log.warn({ agentId, status, error: error.message }, "AgentRepository.setStatus failed");
    }
  }

  /** Return the workspace_id for a given agent. */
  async getWorkspaceId(agentId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from("agents")
      .select("workspace_id")
      .eq("id", agentId)
      .single();

    if (error) {
      log.warn({ agentId, error: error.message }, "AgentRepository.getWorkspaceId failed");
      return null;
    }
    return data?.workspace_id ?? null;
  }

  /**
   * Find the first agent for a workspace that has a fresh heartbeat (< 2 min).
   * Used by the task poller to verify the agent is online before processing.
   */
  async findOnlineAgentForWorkspace(workspaceId: string): Promise<string | null> {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data, error } = await this.db
      .from("agents")
      .select("id")
      .eq("workspace_id", workspaceId)
      .gte("last_seen_at", twoMinutesAgo)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log.warn({ workspaceId, error: error.message }, "AgentRepository.findOnlineAgentForWorkspace failed");
      return null;
    }
    return data?.id ?? null;
  }
}

export const agentRepository = new AgentRepository();
