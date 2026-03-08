"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { GitHubConnection } from "@robin/shared-types";

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

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
    <div className="rounded-xl border border-[#34C759]/40 bg-[#34C759]/5 dark:bg-[#34C759]/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100">
            <GitHubIcon className="h-5 w-5 text-white dark:text-zinc-900" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#1C1C1E] dark:text-white">
              Connesso come{" "}
              <span className="font-semibold">@{connection.github_account_login}</span>
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
              <span className="text-xs text-[#34C759] font-medium">
                Attivo
                {connection.github_account_type === "Organization" && " · Organizzazione"}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          disabled={isPending}
          className={cn(
            "rounded-lg border border-[#FF3B30]/30 px-3 py-1.5 text-xs font-medium text-[#FF3B30] transition-colors",
            "hover:bg-[#FF3B30]/10",
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

function DisconnectedState({
  error,
  onDetect,
  isDetecting,
  detectError,
}: {
  error: string | null;
  onDetect: () => void;
  isDetecting: boolean;
  detectError: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-[#D1D1D6] dark:border-[#38383A] p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F2F7] dark:bg-[#2C2C2E]">
              <GitHubIcon className="h-5 w-5 text-[#8E8E93]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1C1C1E] dark:text-white">
                GitHub non connesso
              </p>
              <p className="text-xs text-[#8E8E93]">
                Connetti per permettere agli agenti di lavorare sulle tue repository.
              </p>
            </div>
          </div>
          <a
            href="/api/auth/github"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <GitHubIcon className="h-3.5 w-3.5" />
            Connetti con GitHub
          </a>
        </div>
      </div>

      {(error || detectError) && (
        <p className="text-xs text-[#FF3B30]">
          {error ?? detectError}
        </p>
      )}

      <p className="text-xs text-[#8E8E93]">
        Hai già installato la GitHub App ma non sei stato reindirizzato?{" "}
        <button
          onClick={onDetect}
          disabled={isDetecting}
          className="inline font-medium text-[#007AFF] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDetecting ? "Verifica in corso..." : "Verifica installazione"}
        </button>
      </p>
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
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

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

  async function handleDetect() {
    setDetectError(null);
    setIsDetecting(true);
    try {
      const res = await fetch("/api/auth/github/detect", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        already_connected?: boolean;
        message?: string;
        error?: string;
      };

      if (res.ok && data.ok) {
        router.refresh();
      } else {
        setDetectError(
          data.message ?? "Nessuna installazione GitHub trovata. Installa prima la GitHub App."
        );
      }
    } catch {
      setDetectError("Errore durante la verifica. Riprova.");
    } finally {
      setIsDetecting(false);
    }
  }

  return (
    <div className="space-y-4">
      {disconnectError && (
        <div className="rounded-xl border border-[#FF3B30]/30 bg-[#FF3B30]/5 px-4 py-3 text-xs text-[#FF3B30]">
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
        <DisconnectedState
          error={initialError}
          onDetect={handleDetect}
          isDetecting={isDetecting}
          detectError={detectError}
        />
      )}

      {connection && (
        <p className="text-xs text-[#8E8E93]">
          Robin.dev App è installata su{" "}
          <span className="font-medium text-[#1C1C1E] dark:text-white">
            @{connection.github_account_login}
          </span>
          . I repository accessibili dipendono dalla configurazione dell&apos;app su GitHub.{" "}
          <a
            href="https://github.com/settings/installations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#007AFF] hover:underline"
          >
            Gestisci su GitHub
          </a>
        </p>
      )}
    </div>
  );
}
