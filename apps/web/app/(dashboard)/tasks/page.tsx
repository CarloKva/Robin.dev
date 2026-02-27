import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Task, TaskStatus } from "@robin/shared-types";
import { TasksPageClient } from "./TasksPageClient";

const PAGE_SIZE = 20;
const ACTIVE_STATUSES: TaskStatus[] = ["queued", "in_progress"];

// ── Period helpers ────────────────────────────────────────────────────────────

function periodStart(period: string): string | null {
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

// ── Page ─────────────────────────────────────────────────────────────────────

interface TasksPageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    priority?: string;
    period?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const params = await searchParams;
  const status = params.status ?? "";
  const type = params.type ?? "";
  const priority = params.priority ?? "";
  const period = params.period ?? "";
  const q = params.q ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();

  // Build query with active filters
  let query = supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspace.id);

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (priority) query = query.eq("priority", priority);

  const since = period ? periodStart(period) : null;
  if (since) query = query.gte("created_at", since);

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  // Active tasks first, then by created_at DESC
  // Supabase doesn't support "order by CASE" directly — sort by created_at,
  // client will visually mark active tasks
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data: tasks, error, count } = await query;

  if (error) {
    console.error("[TasksPage] Failed to fetch tasks:", error.message);
  }

  const taskList = (tasks ?? []) as Task[];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const initialActiveTask = taskList.find((t) =>
    ACTIVE_STATUSES.includes(t.status)
  );

  const filters = { status, type, priority, period };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} task{totalCount !== 1 ? "s" : ""}
            {Object.values(filters).some(Boolean) && " (filtrate)"}
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          + Nuova task
        </Link>
      </div>

      {/* Client Component: handles filters/search/pagination UI + real-time */}
      <TasksPageClient
        tasks={taskList}
        workspaceId={workspace.id}
        initialActiveTaskId={initialActiveTask?.id ?? null}
        initialFilters={filters}
        initialQuery={q}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
      />
    </div>
  );
}
