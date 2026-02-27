"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Task, TaskStatus } from "@robin/shared-types";
import { useActiveTask } from "@/lib/realtime/useActiveTask";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { TaskCard, TaskCardSkeleton } from "@/components/tasks/TaskCard";
import { TaskFilters, type ActiveFilters } from "@/components/tasks/TaskFilters";
import { TaskSearchInput } from "@/components/tasks/TaskSearchInput";

interface TasksPageClientProps {
  tasks: Task[];
  workspaceId: string;
  initialActiveTaskId: string | null;
  initialFilters: ActiveFilters;
  initialQuery: string;
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export function TasksPageClient({
  tasks,
  workspaceId,
  initialActiveTaskId,
  initialFilters,
  initialQuery,
  totalCount,
  totalPages,
  currentPage,
}: TasksPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { activeTaskId, statusOverrides } = useActiveTask({
    workspaceId,
    initialActiveTaskId,
  });

  // Keyboard shortcut: N → navigate to new task form
  const goToNew = useCallback(() => router.push("/tasks/new"), [router]);
  useKeyboardShortcut("n", goToNew);

  // Sort: active tasks first, then by order from server
  const sortedTasks = [...tasks].sort((a, b) => {
    const aActive = a.id === activeTaskId ? -1 : 0;
    const bActive = b.id === activeTaskId ? -1 : 0;
    return aActive - bActive;
  });

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p === 1) {
      params.delete("page");
    } else {
      params.set("page", String(p));
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const isEmpty = tasks.length === 0;
  const hasFilters = Object.values(initialFilters).some(Boolean) || !!initialQuery;

  return (
    <div className="space-y-4">
      {/* Filters + Search bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TaskFilters initialFilters={initialFilters} />
        <TaskSearchInput initialValue={initialQuery} />
      </div>

      {/* Task list */}
      {isEmpty ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div className="space-y-1.5">
          {sortedTasks.map((task) => {
            const liveStatus = statusOverrides.get(task.id) as TaskStatus | undefined;
            return (
              <TaskCard
                key={task.id}
                task={liveStatus ? { ...task, liveStatus } : task}
                isActive={task.id === activeTaskId}
              />
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          onPage={goToPage}
        />
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
        <p className="font-semibold text-foreground">Nessuna task trovata</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Nessuna task corrisponde ai filtri attivi.
        </p>
        <Link
          href="/tasks"
          className="mt-3 inline-block text-sm text-primary underline hover:no-underline"
        >
          Rimuovi tutti i filtri
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-semibold text-foreground">Nessuna task ancora</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Crea la tua prima task per iniziare.
      </p>
      <Link
        href="/tasks/new"
        className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
      >
        + Nuova task
      </Link>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  totalCount,
  onPage,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        {totalCount} task totali · Pagina {currentPage} di {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-accent transition-colors"
        >
          ← Precedente
        </button>
        <button
          onClick={() => onPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-accent transition-colors"
        >
          Successiva →
        </button>
      </div>
    </div>
  );
}

// Re-export skeleton for loading.tsx
export { TaskCardSkeleton };
