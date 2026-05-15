import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import { useChannel } from './useChannel';

export interface RosterAgent {
  id: string;
  name: string;
  hue: number;
  src?: string;
}

interface AgentRow {
  id: string;
  name: string;
  hue?: number | null;
  avatar_url?: string | null;
}

/**
 * Workspace agent roster used by `PopoverHeader`'s AvatarStack. Subscribes to
 * INSERT/UPDATE on the `agents` table filtered by workspace_id and re-fetches
 * the full list on change (cheap — agent count is small).
 */
export function useAgentsRoster(workspaceId: string | null): RosterAgent[] {
  const [agents, setAgents] = useState<RosterAgent[]>([]);

  const refetch = useCallback(async () => {
    if (!workspaceId) {
      setAgents([]);
      return;
    }
    const { data, error } = await supabase()
      .from('agents')
      .select('id, name, hue, avatar_url')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('useAgentsRoster fetch failed', error.message);
      return;
    }
    const rows = (data ?? []) as AgentRow[];
    setAgents(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        hue: row.hue ?? deterministicHue(row.id),
        ...(row.avatar_url ? { src: row.avatar_url } : {}),
      })),
    );
  }, [workspaceId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useChannel({
    channelName: `agents-roster-${workspaceId ?? 'none'}`,
    table: 'agents',
    event: '*',
    ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
    onPayload: () => {
      void refetch();
    },
    enabled: Boolean(workspaceId),
  });

  return agents;
}

function deterministicHue(id: string): number {
  let acc = 0;
  for (const ch of id) acc = (acc * 31 + ch.charCodeAt(0)) >>> 0;
  return acc % 360;
}
