import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getTasksForWorkspace } from "@/lib/db/tasks";
import type { TaskStatus } from "@robin/shared-types";
import { TasksPageClient } from "./TasksPageClient";

const PAGE_SIZE = 20;
const ACTIVE_STATUSES: TaskStatus[] = ["queued", "in_progress"];

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

  const { tasks: taskList, totalCount, totalPages } = await getTasksForWorkspace(workspace.id, {
    ...(status && { status }),
    ...(type && { type }),
    ...(priority && { priority }),
    ...(period && { period }),
    ...(q && { q }),
    page,
    pageSize: PAGE_SIZE,
  });

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
