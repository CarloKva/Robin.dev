import { Bot } from "lucide-react";
import type { Agent } from "@robin/shared-types";

interface AgentCardProps {
  agent: Agent | null;
  queuedAt: string | null;
}

export function AgentCard({ agent, queuedAt }: AgentCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Eseguito da
      </h3>

      {agent ? (
        <div className="flex items-start gap-3">
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="h-8 w-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
              <Bot className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
            <p className="text-xs text-muted-foreground">{agent.type}</p>
            {agent.orchestrator_version && (
              <p className="text-xs text-muted-foreground">
                v{agent.orchestrator_version}
              </p>
            )}
            {queuedAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(queuedAt).toLocaleString("it-IT", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nessun agente assegnato</p>
      )}
    </div>
  );
}
