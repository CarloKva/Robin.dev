"use client";

import type { Task } from "@robin/shared-types";

interface SprintProgressBarProps {
  tasks: Task[];
}

const DONE_STATUSES = new Set(["done", "completed"]);
const FAILED_STATUSES = new Set(["failed", "cancelled"]);

export function SprintProgressBar({ tasks }: SprintProgressBarProps) {
  if (tasks.length === 0) return null;

  const done = tasks.filter((t) => DONE_STATUSES.has(t.status)).length;
  const failed = tasks.filter((t) => FAILED_STATUSES.has(t.status)).length;
  const total = tasks.length;
  const pctDone = Math.round((done / total) * 100);
  const pctFailed = Math.round((failed / total) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {done} / {total} task completate
        </span>
        <span className="text-muted-foreground">{pctDone}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="flex h-full">
          <div
            className="bg-green-500 transition-all duration-500"
            style={{ width: `${pctDone}%` }}
          />
          <div
            className="bg-red-400 transition-all duration-500"
            style={{ width: `${pctFailed}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          {done} completate
        </span>
        {failed > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            {failed} fallite/annullate
          </span>
        )}
        <span>{total - done - failed} in corso/in coda</span>
      </div>
    </div>
  );
}
