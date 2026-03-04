"use client";

import { useState, useTransition } from "react";
import { Dices } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Repository } from "@robin/shared-types";

interface AgentCreationFormProps {
  repositories: Repository[];
  hasGitHubConnection: boolean;
  onClose: () => void;
}

// Jikan API has a 1 req/sec rate limit. Since this is user-triggered (button click),
// no debounce is needed — the user can't click faster than the spinner resets.
async function fetchAnimeCharacter(): Promise<{ name: string; imageUrl: string | null }> {
  const res = await fetch("https://api.jikan.moe/v4/random/characters");
  if (!res.ok) throw new Error("Jikan API error");
  const json = await res.json() as { data: { name: string; images: { jpg: { image_url: string } } } };
  return {
    name: json.data.name,
    imageUrl: json.data.images?.jpg?.image_url ?? null,
  };
}

function dicebearUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

export function AgentCreationForm({
  repositories,
  hasGitHubConnection,
  onClose,
}: AgentCreationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const enabledRepos = repositories.filter((r) => r.is_enabled && r.is_available);

  // The displayed avatar: explicit URL from Jikan, or Dicebear fallback when name is set
  const previewAvatarUrl = avatarUrl ?? (name.trim() ? dicebearUrl(name.trim()) : null);

  async function handleAutoGenerate() {
    setIsGenerating(true);
    try {
      const { name: charName, imageUrl } = await fetchAnimeCharacter();
      setName(charName);
      // Use Jikan image if available, otherwise fall back to Dicebear
      setAvatarUrl(imageUrl ?? dicebearUrl(charName));
    } catch {
      // On error, keep current name; avatar will fall back to Dicebear via previewAvatarUrl
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleRepo(repoId: string) {
    setSelectedRepoIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Inserisci un nome per l'agente");
      return;
    }
    if (selectedRepoIds.length === 0) {
      setError("Seleziona almeno un repository");
      return;
    }

    // Resolve final avatar URL: explicit one set (from Jikan or manual) or Dicebear fallback
    const finalAvatarUrl = avatarUrl ?? dicebearUrl(name.trim());

    startTransition(async () => {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          repository_ids: selectedRepoIds,
          avatar_url: finalAvatarUrl,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        agent?: { id: string };
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        if (data.code === "GITHUB_NOT_CONNECTED") {
          setError("Connetti prima GitHub nelle impostazioni.");
        } else {
          setError(data.error ?? "Errore nella creazione dell'agente");
        }
        return;
      }

      router.push(`/agents/${data.agent!.id}`);
      router.refresh();
      onClose();
    });
  }

  if (!hasGitHubConnection) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          Prima di creare un agente, connetti il tuo account GitHub nelle{" "}
          <a href="/settings" className="font-medium underline">
            Impostazioni
          </a>
          .
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name + auto-generate */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="agent-name">
          Nome agente
        </label>
        <div className="flex items-center gap-2">
          {/* Avatar preview */}
          {previewAvatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewAvatarUrl}
              alt="Avatar anteprima"
              className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
            />
          )}
          <input
            id="agent-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              // Clear explicit avatar so Dicebear follows the new name
              setAvatarUrl(null);
            }}
            placeholder="es. Agent Alpha"
            maxLength={100}
            autoFocus
            disabled={isPending}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={isGenerating || isPending}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title="Genera nome e avatar da un personaggio anime casuale"
          >
            {isGenerating ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <Dices className="h-3.5 w-3.5" />
            )}
            Genera
          </button>
        </div>
      </div>

      {/* Repository selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Repository
          {selectedRepoIds.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({selectedRepoIds.length} selezionati)
            </span>
          )}
        </label>
        {enabledRepos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nessun repository abilitato.{" "}
            <a href="/settings" className="underline">
              Abilitane uno nelle impostazioni.
            </a>
          </p>
        ) : (
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {enabledRepos.map((repo) => {
              const checked = selectedRepoIds.includes(repo.id);
              return (
                <label
                  key={repo.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    checked
                      ? "bg-primary/10 ring-1 ring-primary/20 text-foreground"
                      : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background"
                    )}
                  >
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRepo(repo.id)}
                    disabled={isPending}
                    className="sr-only"
                  />
                  <span className="min-w-0 truncate font-mono text-xs">{repo.full_name}</span>
                  {repo.is_private && (
                    <span className="ml-auto shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      private
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={isPending || !name.trim() || selectedRepoIds.length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creazione in corso..." : "Crea agente"}
        </button>
      </div>
    </form>
  );
}
