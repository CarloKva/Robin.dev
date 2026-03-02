"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TaskRow } from "./TaskRow";
import { BacklogFilters } from "./BacklogFilters";
import { BulkActionBar } from "./BulkActionBar";
import { ImportPreviewModal } from "./ImportPreviewModal";
import { parseRobinMd } from "@/lib/robin-md-parser";
import type { Task, Repository, Sprint } from "@robin/shared-types";
import type { ParsedTask, ParseError } from "@/types/robin-md";

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB

interface BacklogClientProps {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  repositories: Repository[];
  sprints: Sprint[];
}

export function BacklogClient({ tasks, total, page, pageSize, repositories, sprints }: BacklogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Import state
  type ImportModal = { tasks: ParsedTask[]; errors: ParseError[]; truncated: boolean; originalCount: number };
  const [importModal, setImportModal] = useState<ImportModal | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleImportClick() {
    setImportFileError(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setImportFileError("Il file supera il limite di 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content !== "string") return;
      const result = parseRobinMd(content);
      setImportModal({
        tasks: result.tasks,
        errors: result.errors,
        truncated: result.truncated === true,
        originalCount: result.originalCount ?? result.tasks.length + result.errors.length,
      });
    };
    reader.readAsText(file);
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === tasks.length ? new Set() : new Set(tasks.map((t) => t.id))
    );
  }, [tasks]);

  const totalPages = Math.ceil(total / pageSize);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleBulkDone() {
    setSelectedIds(new Set());
    startTransition(() => router.refresh());
  }

  const backlogCount = tasks.filter((t) => t.status === "backlog").length;
  const readyCount = tasks.filter((t) => t.status === "sprint_ready").length;

  return (
    <div className="space-y-4">
      {/* Hidden file input for .robin.md import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import preview modal */}
      {importModal !== null && (
        <ImportPreviewModal
          tasks={importModal.tasks}
          errors={importModal.errors}
          truncated={importModal.truncated}
          originalCount={importModal.originalCount}
          repositories={repositories}
          onClose={() => setImportModal(null)}
          onImported={() => {
            setImportModal(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {/* Filters + import button row */}
      <div className="flex flex-wrap items-center gap-2">
        <BacklogFilters repositories={repositories} />
        <div className="flex-1" />
        <button
          onClick={handleImportClick}
          className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
          title="Importa task da file .robin.md"
        >
          ↑ Importa .robin.md
        </button>
        {importFileError !== null && (
          <span className="text-xs text-red-600 dark:text-red-400">{importFileError}</span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{total} task totali</span>
        {backlogCount > 0 && <span>{backlogCount} in backlog</span>}
        {readyCount > 0 && <span className="text-green-600">{readyCount} pronte per sprint</span>}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">Nessuna task trovata.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Premi <kbd className="rounded border border-border px-1 py-0.5 font-mono text-xs">N</kbd> per crearne una.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {/* Select all header */}
          <div className="flex items-center gap-3 border-b border-border px-3 py-2">
            <input
              type="checkbox"
              checked={selectedIds.size === tasks.length && tasks.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-border accent-primary"
              aria-label="Seleziona tutto"
            />
            <span className="text-xs text-muted-foreground">Seleziona tutto</span>
            {selectedIds.size > 0 && (
              <span className="text-xs text-primary">{selectedIds.size} selezionate</span>
            )}
          </div>

          <div className="divide-y divide-border">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={selectedIds.has(task.id)}
                onSelectToggle={toggleSelect}
                repositories={repositories}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} di {totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={[...selectedIds]}
        sprints={sprints}
        onDone={handleBulkDone}
      />
    </div>
  );
}
