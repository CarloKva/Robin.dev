"use client";

import type { AgentStatusEnum } from "@robin/shared-types";
import { useAgentStatus } from "@/lib/realtime/useAgentStatus";
import { AgentStatusBadge } from "./AgentStatusBadge";

interface AgentStatusWidgetProps {
  workspaceId: string;
  initialStatus: AgentStatusEnum;
  initialTaskTitle: string | null;
}

/**
 * Client Component wrapper around AgentStatusBadge.
 * Subscribes to workspace-level Realtime events and updates the badge live.
 *
 * Initial state is provided by the Server Component (layout.tsx) to avoid
 * a loading flash on first render.
 */
export function AgentStatusWidget({
  workspaceId,
  initialStatus,
  initialTaskTitle,
}: AgentStatusWidgetProps) {
  const { status, taskTitle, isOffline } = useAgentStatus({
    workspaceId,
    initialStatus,
    initialTaskTitle,
  });

  return (
    <AgentStatusBadge
      status={status}
      {...(taskTitle ? { taskTitle } : {})}
      isOffline={isOffline}
    />
  );
}
