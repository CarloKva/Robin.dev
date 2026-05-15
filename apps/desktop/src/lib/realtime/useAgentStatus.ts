import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import type { AgentStatusEnum } from '@robin/shared-types';
import { useChannel } from './useChannel';

export interface AgentWithStatus {
  id: string;
  name: string;
  hue: number;
  avatarUrl: string | null;
  status: AgentStatusEnum;
  effectiveStatus: AgentStatusEnum;
  currentTaskId: string | null;
  lastSeenAt: string | null;
  specialty: string[];
}

/**
 * Reads `agents_with_status` view (joins `agents` + `agent_status`). Subscribes
 * to changes on both source tables. The view derives `effective_status` from
 * `last_seen_at` so we don't have to re-derive client-side.
 */
export function useAgentStatus(workspaceId: string | null): AgentWithStatus[] {
  const [agents, setAgents] = useState<AgentWithStatus[]>([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setAgents([]);
      return;
    }
    const { data, error } = await supabase()
      .from('agents_with_status')
      .select(
        'id, name, hue, avatar_url, status, effective_status, current_task_id, last_seen_at, specialty',
      )
      .eq('workspace_id', workspaceId)
      .order('last_seen_at', { ascending: false, nullsFirst: false });
    if (error) {
      console.warn('useAgentStatus fetch failed', error.message);
      return;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    setAgents(
      rows.map((row) => ({
        id: row['id'] as string,
        name: row['name'] as string,
        hue: (row['hue'] as number | null) ?? 16,
        avatarUrl: (row['avatar_url'] as string | null) ?? null,
        status: (row['status'] as AgentStatusEnum) ?? 'offline',
        effectiveStatus: (row['effective_status'] as AgentStatusEnum) ?? 'offline',
        currentTaskId: (row['current_task_id'] as string | null) ?? null,
        lastSeenAt: (row['last_seen_at'] as string | null) ?? null,
        specialty: (row['specialty'] as string[] | null) ?? [],
      })),
    );
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useChannel({
    channelName: `agent-status-agents-${workspaceId ?? 'none'}`,
    table: 'agents',
    event: '*',
    ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
    onPayload: () => {
      void refresh();
    },
    enabled: Boolean(workspaceId),
  });
  useChannel({
    channelName: `agent-status-status-${workspaceId ?? 'none'}`,
    table: 'agent_status',
    event: '*',
    ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
    onPayload: () => {
      void refresh();
    },
    enabled: Boolean(workspaceId),
  });

  return agents;
}
