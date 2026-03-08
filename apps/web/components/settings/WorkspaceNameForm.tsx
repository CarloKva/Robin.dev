"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function WorkspaceNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isDirty = name.trim() !== initialName && name.trim() !== "";

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

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
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
        aria-label="Nome workspace"
      />

      {/* Save button — visible only on dirty state */}
      <div
        className={cn(
          "flex items-center justify-end gap-2 transition-all duration-200",
          isDirty ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
        )}
      >
        {success && (
          <span className="text-xs text-[#34C759]">Salvato</span>
        )}
        {error && (
          <span className="text-xs text-[#FF3B30]">{error}</span>
        )}
        <button
          type="submit"
          disabled={isPending || !isDirty}
          className="rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </form>
  );
}
