"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface CompleteSprintButtonProps {
  sprintId: string;
}

export function CompleteSprintButton({ sprintId }: CompleteSprintButtonProps) {
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleComplete() {
    if (!confirm("Chiudere lo sprint? Le task non completate torneranno nel backlog.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sprints/${sprintId}/complete`, { method: "POST" });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={() => void handleComplete()}
      disabled={loading}
      className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 min-h-[44px]"
    >
      {loading ? "Chiudendo..." : "Chiudi sprint"}
    </button>
  );
}
