"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export function WorkspaceNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) return;
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Errore durante il salvataggio.");
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  const isUnchanged = name.trim() === initialName || name.trim() === "";

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSuccess(false);
          setError(null);
        }}
        maxLength={100}
        error={error !== null}
        className="h-9 flex-1"
        aria-label="Nome workspace"
      />
      <button
        type="submit"
        disabled={isPending || isUnchanged}
        className="h-9 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-opacity disabled:opacity-40"
      >
        {isPending ? "..." : "Salva"}
      </button>
      {success && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">Salvato</span>
      )}
      {error && (
        <span className="text-xs text-[#FF3B30]">{error}</span>
      )}
    </form>
  );
}
