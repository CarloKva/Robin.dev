"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SprintNameInlineEditorProps {
  sprintId: string;
  initialName: string;
  className?: string;
}

export function SprintNameInlineEditor({
  sprintId,
  initialName,
  className,
}: SprintNameInlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Il nome non può essere vuoto");
      inputRef.current?.focus();
      return;
    }
    if (trimmed === initialName) {
      setEditing(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        setError("Errore nel salvataggio");
        setSaving(false);
        inputRef.current?.focus();
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Errore nel salvataggio");
      setSaving(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    } else if (e.key === "Escape") {
      setName(initialName);
      setEditing(false);
      setError(null);
    }
  }

  function handleBlur() {
    void handleSave();
  }

  if (editing) {
    return (
      <span className="flex flex-col gap-1">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={saving}
          maxLength={100}
          className={cn(
            "rounded border border-primary bg-background px-2 py-0.5 font-bold outline-none",
            "focus:ring-2 focus:ring-primary/30 disabled:opacity-50",
            className
          )}
        />
        {error && (
          <span className="text-xs font-normal text-destructive">{error}</span>
        )}
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Clicca per modificare il nome"
      className={cn(
        "cursor-text underline decoration-dashed underline-offset-4 decoration-muted-foreground/40",
        "hover:decoration-muted-foreground transition-colors",
        className
      )}
    >
      {name}
    </span>
  );
}
