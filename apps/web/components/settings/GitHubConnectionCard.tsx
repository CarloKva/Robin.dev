"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { GitHubConnection } from "@robin/shared-types";

// ─── Connected state ─────────────────────────────────────────────────────────

function ConnectedState({
  connection,
  onDisconnect,
  isPending,
}: {
  connection: GitHubConnection;
  onDisconnect: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {/* GitHub logo placeholder */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <svg height="18" viewBox="0 0 16 16" width="18" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            GitHub connesso
          </p>
          <p className="text-xs text-muted-foreground">
            @{connection.github_account_login}
            {connection.github_account_type === "Organization" && " (organizzazione)"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Attivo
        </span>
        <button
          onClick={onDisconnect}
          disabled={isPending}
          className={cn(
            "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
            "hover:border-red-300 hover:bg-red-50 hover:text-red-600",
            "dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-400",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {isPending ? "Disconnessione..." : "Disconnetti"}
        </button>
      </div>
    </div>
  );
}

// ─── Disconnected state ───────────────────────────────────────────────────────

function DisconnectedState({ error }: { error: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <svg height="18" viewBox="0 0 16 16" width="18" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">GitHub non connesso</p>
          <p className="text-xs text-muted-foreground">
            Connetti il tuo account per permettere agli agenti di lavorare sulle tue repository.
          </p>
        </div>
      </div>
      <a
        href="/api/auth/github"
        className={cn(
          "inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition-colors",
          "hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        )}
      >
        Connetti GitHub
      </a>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GitHubConnectionCardProps {
  connection: GitHubConnection | null;
  initialError: string | null;
}

export function GitHubConnectionCard({
  connection,
  initialError,
}: GitHubConnectionCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  async function handleDisconnect() {
    setDisconnectError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/github", { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string; agents?: unknown[] };
        if (data.agents && Array.isArray(data.agents) && data.agents.length > 0) {
          setDisconnectError(
            "Elimina prima tutti gli agenti attivi prima di disconnettere GitHub."
          );
        } else {
          setDisconnectError(data.error ?? "Impossibile disconnettere GitHub");
        }
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-6">
      <h2 className="text-base font-semibold">Connessioni</h2>

      {disconnectError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {disconnectError}
        </div>
      )}

      {connection ? (
        <ConnectedState
          connection={connection}
          onDisconnect={handleDisconnect}
          isPending={isPending}
        />
      ) : (
        <DisconnectedState error={initialError} />
      )}

      {connection && (
        <p className="text-xs text-muted-foreground">
          Robin.dev App è installata su{" "}
          <span className="font-medium">@{connection.github_account_login}</span>. I repository
          accessibili dipendono dalla configurazione dell'app su GitHub.{" "}
          <a
            href={`https://github.com/settings/installations`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            Gestisci su GitHub
          </a>
        </p>
      )}
    </section>
  );
}
