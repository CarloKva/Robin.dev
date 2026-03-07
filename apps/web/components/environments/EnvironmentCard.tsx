"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { WorkspaceEnvironment } from "@robin/shared-types";
import { EnvVarsModal } from "./EnvVarsModal";

interface EnvironmentCardProps {
  environment: WorkspaceEnvironment;
  onUpdated: (env: WorkspaceEnvironment) => void;
  onDeleted: (id: string) => void;
}

export function EnvironmentCard({
  environment,
  onUpdated,
  onDeleted,
}: EnvironmentCardProps) {
  const [autoMerge, setAutoMerge] = useState(environment.auto_merge);
  const [toggling, setToggling] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleAutoMergeToggle() {
    const newValue = !autoMerge;

    if (newValue && environment.target_branch === "main") {
      return; // Guard: never allow toggle on main
    }

    setToggling(true);
    try {
      const res = await fetch(`/api/environments/${environment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoMerge: newValue }),
      });

      if (res.ok) {
        const data = (await res.json()) as { environment: WorkspaceEnvironment };
        setAutoMerge(newValue);
        onUpdated(data.environment);
      }
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminare l'ambiente "${environment.name}"?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/environments/${environment.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted(environment.id);
      }
    } finally {
      setDeleting(false);
    }
  }

  const isProduction = environment.environment_type === "production";

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground truncate">
                {environment.name}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  isProduction
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                )}
              >
                {isProduction ? "Production" : "Staging"}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
              {environment.target_branch}
            </p>
          </div>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
            title="Elimina ambiente"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Auto-merge toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Auto-merge</p>
            {environment.target_branch === "main" ? (
              <p className="text-xs text-destructive">
                Non disponibile su main
              </p>
            ) : autoMerge ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Le PR verranno mergiate automaticamente dopo che i CI checks passano
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Disabilitato
              </p>
            )}
          </div>

          <button
            role="switch"
            aria-checked={autoMerge}
            onClick={handleAutoMergeToggle}
            disabled={toggling || environment.target_branch === "main"}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              autoMerge ? "bg-foreground" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                autoMerge ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Env vars button */}
        <div className="pt-1 border-t border-border">
          <button
            onClick={() => setShowEnvVars(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            Variabili d&apos;ambiente
            {environment.env_vars_encrypted && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                configurate
              </span>
            )}
          </button>
        </div>
      </div>

      {showEnvVars && (
        <EnvVarsModal
          environmentId={environment.id}
          environmentName={environment.name}
          onClose={() => setShowEnvVars(false)}
        />
      )}
    </>
  );
}
