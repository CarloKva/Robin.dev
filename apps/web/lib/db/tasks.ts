import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Task } from "@robin/shared-types";

export interface GetTasksOptions {
  status?: string;
  type?: string;
  priority?: string;
  /** "today" | "week" | "month" — filters by created_at */
  period?: string;
  /** Full-text search on title + description */
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface GetTasksResult {
  tasks: Task[];
  totalCount: number;
  totalPages: number;
}

/** Returns an ISO date string representing the start of the given period, or null. */
export function periodStart(period: string): string | null {
  const now = new Date();
  switch (period) {
    case "today": {
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    }
    case "week": {
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    }
    case "month": {
      now.setDate(now.getDate() - 30);
      return now.toISOString();
    }
    default:
      return null;
  }
}

/**
 * Fetches tasks for a workspace with optional filters and pagination.
 * Ordered by created_at DESC.
 */
export async function getTasksForWorkspace(
  workspaceId: string,
  options: GetTasksOptions = {}
): Promise<GetTasksResult> {
  const { status, type, priority, period, q, page = 1, pageSize = 20 } = options;
  const offset = (page - 1) * pageSize;

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId);

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (priority) query = query.eq("priority", priority);

  const since = period ? periodStart(period) : null;
  if (since) query = query.gte("created_at", since);

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("[getTasksForWorkspace]", error.message);
  }

  const tasks = (data ?? []) as Task[];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return { tasks, totalCount, totalPages };
}
