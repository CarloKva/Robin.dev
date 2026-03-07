import { Worker, Queue } from "bullmq";
import type { Job } from "bullmq";
import type { RepoQueueJobPayload, JobPayload } from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { getSupabaseClient } from "../db/supabase.client";
import { defaultTimeoutByType } from "../config/bullmq.config";
import { taskQueue } from "../queues/task.queue";
import { notificationService } from "../services/notification.service";
import { log } from "../utils/logger";

const STALE_WAIT_MINUTES = 30;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * RepoQueueWorker — Sprint B EPIC-B6
 *
 * Manages per-repository queues to enforce sequential task execution per repo.
 * Rule: for each repository, only one task executes at a time.
 * Tasks across different repos execute in parallel.
 *
 * Algorithm (TASK-B.14.1):
 * 1. If task has preferred_agent_id → use that agent (if online)
 * 2. Otherwise: agent assigned to repo with least tasks in last 24h (load balancing)
 * 3. Tiebreaker: most recently provisioned agent
 * 4. No agent available: keep task in `queued`, poll every 5min, notify after 30min
 */

const activeRepoWorkers = new Map<string, Worker<RepoQueueJobPayload>>();
const notificationTimers = new Map<string, NodeJS.Timeout>();

export function createRepoQueueWorker(repositoryId: string): Worker<RepoQueueJobPayload> {
  const existing = activeRepoWorkers.get(repositoryId);
  if (existing) return existing;

  const worker = new Worker<RepoQueueJobPayload>(
    `repo-queue-${repositoryId}`,
    async (job: Job<RepoQueueJobPayload>) => {
      return processRepoJob(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: 1, // Sequential per repo — this is the key constraint
      autorun: true,
    }
  );

  worker.on("error", (err) => {
    log.error({ repositoryId, error: err.message }, "RepoQueueWorker error");
  });

  activeRepoWorkers.set(repositoryId, worker);
  log.info({ repositoryId }, "RepoQueueWorker started");
  return worker;
}

async function processRepoJob(job: Job<RepoQueueJobPayload>): Promise<void> {
  const { taskId, workspaceId, repositoryId, sprintId } = job.data;
  const supabase = getSupabaseClient();

  log.info({ jobId: job.id, taskId, repositoryId }, "RepoQueue processing task");

  // ── 1. Load task ───────────────────────────────────────────────────────────
  const { data: task } = await supabase
    .from("tasks")
    .select("*, repositories(id, full_name, default_branch)")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    log.warn({ taskId }, "Task not found — skipping");
    return;
  }

  // Skip if task was cancelled or already handled
  if (!["queued", "sprint_ready"].includes(task.status)) {
    log.info({ taskId, status: task.status }, "Task no longer queued — skipping");
    return;
  }

  // ── 2. Select agent (routing algorithm) ────────────────────────────────────
  const agentId = await selectAgent(taskId, workspaceId, repositoryId, task.preferred_agent_id);

  if (!agentId) {
    // No agent available — keep task in queued, notify after 30min
    await handleNoAgentAvailable(taskId, workspaceId, task.title, job);
    return;
  }

  // Clear stale notification timer if agent became available
  const timer = notificationTimers.get(taskId);
  if (timer) {
    clearTimeout(timer);
    notificationTimers.delete(taskId);
  }

  // ── 3. Load repository details ─────────────────────────────────────────────
  const { data: repo } = await supabase
    .from("repositories")
    .select("*")
    .eq("id", repositoryId)
    .maybeSingle();

  // ── 4. Persist agent assignment ────────────────────────────────────────────
  await supabase
    .from("tasks")
    .update({
      assigned_agent_id: agentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  // ── 5. Enqueue in the task worker queue for this agent ─────────────────────
  const jobPayload: JobPayload = {
    taskId,
    workspaceId,
    agentId,
    repositoryUrl: repo
      ? `https://github.com/${repo.full_name}.git`
      : process.env["DEFAULT_REPOSITORY_URL"] ?? "",
    branch: repo?.default_branch ?? process.env["DEFAULT_BRANCH"] ?? "main",
    repositoryPath: `/workspace/${repo?.full_name?.split("/")[1] ?? "repo"}`,
    taskTitle: task.title,
    taskDescription: task.description ?? "",
    taskType: (task.type as JobPayload["taskType"]) ?? "feature",
    priority: (task.priority as JobPayload["priority"]) ?? "medium",
    timeoutMinutes: defaultTimeoutByType[task.type ?? "feature"] ?? 30,
    claudeMdPath: "CLAUDE.md",
    attachments: (task.attachments as string[] | null) ?? [],
  };

  await taskQueue.addJob(jobPayload);
  log.info({ taskId, agentId, repositoryId }, "Task dispatched to task worker queue");
}

/**
 * Routing algorithm (TASK-B.14.1):
 * 1. preferred_agent_id if online
 * 2. Agent with fewest completed tasks in last 24h for this repo (load balancing)
 * 3. Tiebreaker: most recently provisioned_at
 */
async function selectAgent(
  taskId: string,
  workspaceId: string,
  repositoryId: string,
  preferredAgentId: string | null
): Promise<string | null> {
  const supabase = getSupabaseClient();

  // Get all online agents assigned to this repo
  const { data: agentRepos } = await supabase
    .from("agent_repositories")
    .select("agent_id")
    .eq("repository_id", repositoryId);

  if (!agentRepos?.length) return null;

  const assignedIds = agentRepos.map((ar: { agent_id: string }) => ar.agent_id);

  const { data: onlineAgents } = await supabase
    .from("agents_with_status")
    .select("id, provisioned_at")
    .eq("workspace_id", workspaceId)
    .in("id", assignedIds)
    .in("effective_status", ["idle", "busy"])
    .order("provisioned_at", { ascending: false });

  if (!onlineAgents?.length) return null;

  // Priority 1: preferred_agent_id if online
  if (preferredAgentId) {
    const preferred = onlineAgents.find((a: { id: string }) => a.id === preferredAgentId);
    if (preferred) return preferred.id;
    log.warn({ taskId, preferredAgentId }, "Preferred agent offline — falling back to auto-routing");
  }

  // Priority 2: load balancing — agent with fewest completed tasks in last 24h for this repo
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const agentIds = onlineAgents.map((a: { id: string }) => a.id);

  const { data: recentJobs } = await supabase
    .from("tasks")
    .select("assigned_agent_id")
    .eq("repository_id", repositoryId)
    .in("status", ["done", "completed"])
    .in("assigned_agent_id", agentIds)
    .gte("updated_at", since);

  const loadCounts: Record<string, number> = {};
  for (const job of recentJobs ?? []) {
    if (job.assigned_agent_id) {
      loadCounts[job.assigned_agent_id] = (loadCounts[job.assigned_agent_id] ?? 0) + 1;
    }
  }

  // Sort by load (ascending), then by provisioned_at (descending = newest first)
  const sorted = [...onlineAgents].sort((a: { id: string; provisioned_at: string | null }, b: { id: string; provisioned_at: string | null }) => {
    const loadDiff = (loadCounts[a.id] ?? 0) - (loadCounts[b.id] ?? 0);
    if (loadDiff !== 0) return loadDiff;
    // Tiebreaker: most recently provisioned
    const aTime = a.provisioned_at ? new Date(a.provisioned_at).getTime() : 0;
    const bTime = b.provisioned_at ? new Date(b.provisioned_at).getTime() : 0;
    return bTime - aTime;
  });

  return sorted[0]?.id ?? null;
}

async function handleNoAgentAvailable(
  taskId: string,
  workspaceId: string,
  taskTitle: string,
  job: Job<RepoQueueJobPayload>
): Promise<void> {
  log.warn({ taskId }, "No agent available for task — will retry");

  // Set up 30-minute notification timer (only once)
  if (!notificationTimers.has(taskId)) {
    const timer = setTimeout(async () => {
      notificationTimers.delete(taskId);
      await notificationService.notifyTaskBlocked(
        { id: taskId, title: taskTitle, workspaceId },
        "Nessun agente online disponibile per questa repository da più di 30 minuti."
      );
    }, STALE_WAIT_MINUTES * 60 * 1000);

    notificationTimers.set(taskId, timer);
  }

  // Delay job and retry in 5 minutes
  await job.moveToDelayed(Date.now() + POLL_INTERVAL_MS);
}

/**
 * Start repo queue workers for all repositories that have tasks in `queued` status.
 * Called on orchestrator startup to reconstruct queues from DB state (TASK-B.13.5).
 */
export async function reconstructRepoQueues(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: queuedTasks } = await supabase
    .from("tasks")
    .select("repository_id, workspace_id, sprint_id, id, sprint_order")
    .eq("status", "queued")
    .not("sprint_id", "is", null)
    .not("repository_id", "is", null);

  if (!queuedTasks?.length) {
    log.info({}, "No queued sprint tasks found — no repo queues to reconstruct");
    return;
  }

  // Group by repository
  const byRepo = new Map<string, typeof queuedTasks>();
  for (const t of queuedTasks) {
    const key = t.repository_id as string;
    if (!byRepo.has(key)) byRepo.set(key, []);
    byRepo.get(key)!.push(t);
  }

  log.info({ repoCount: byRepo.size }, "Reconstructing repo queues from DB");

  for (const [repositoryId, tasks] of byRepo) {
    createRepoQueueWorker(repositoryId);

    const queue = new Queue<RepoQueueJobPayload>(`repo-queue-${repositoryId}`, {
      connection: getRedisConnection(),
    });

    // Add jobs that aren't already in the queue (idempotent via jobId)
    const sorted = tasks.sort((a, b) => (a.sprint_order ?? 0) - (b.sprint_order ?? 0));
    for (const task of sorted) {
      try {
        await queue.add(
          `task:${task.id}`,
          {
            taskId: task.id as string,
            workspaceId: task.workspace_id as string,
            repositoryId,
            sprintId: task.sprint_id as string,
            sprintOrder: task.sprint_order as number ?? 0,
          },
          {
            jobId: `sprint:${task.sprint_id}:task:${task.id}`,
            priority: task.sprint_order as number ?? 999,
          }
        );
      } catch {
        // Job already exists in queue — skip (idempotent)
      }
    }

    await queue.close();
  }

  log.info({ repoCount: byRepo.size }, "Repo queues reconstructed");
}

export async function closeAllRepoWorkers(): Promise<void> {
  await Promise.all([...activeRepoWorkers.values()].map((w) => w.close()));
  activeRepoWorkers.clear();
  for (const timer of notificationTimers.values()) clearTimeout(timer);
  notificationTimers.clear();
}
