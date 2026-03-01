"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface CreateSprintButtonProps {
  className?: string;
}

export function CreateSprintButton({ className }: CreateSprintButtonProps) {
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const { sprint } = await res.json();
        startTransition(() => router.push(`/sprints/${sprint.id}`));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={() => void handleCreate()}
      disabled={loading}
      className={cn(
        "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
        "hover:bg-primary/90 disabled:opacity-50 min-h-[44px] flex items-center",
        className
      )}
    >
      {loading ? "Creando..." : "+ Nuovo sprint"}
    </button>
  );
}
