import type { Task } from "@robin/shared-types";

type TaskStatus = Task["status"];

export const PRIORITY_ICONS: Record<string, { icon: string; className: string }> = {
  critical: { icon: "↑↑", className: "text-red-600 font-bold" },
  high: { icon: "↑", className: "text-orange-500 font-semibold" },
  medium: { icon: "=", className: "text-yellow-600" },
  low: { icon: "—", className: "text-slate-400" },
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  sprint_ready: "Da fare",
  pending: "In attesa",
  queued: "In coda",
  in_progress: "In progress",
  in_review: "In review",
  rework: "Rework",
  review_pending: "Review",
  approved: "Approvato",
  rejected: "Rifiutato",
  done: "Fatto",
  completed: "Completato",
  failed: "Fallito",
  cancelled: "Annullato",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-slate-300 dark:bg-slate-600",
  sprint_ready: "bg-blue-400",
  pending: "bg-slate-400",
  queued: "bg-blue-500",
  in_progress: "bg-blue-600",
  in_review: "bg-yellow-500",
  rework: "bg-orange-500",
  review_pending: "bg-yellow-400",
  approved: "bg-green-400",
  rejected: "bg-red-400",
  done: "bg-green-500",
  completed: "bg-green-600",
  failed: "bg-red-500",
  cancelled: "bg-slate-400",
};
