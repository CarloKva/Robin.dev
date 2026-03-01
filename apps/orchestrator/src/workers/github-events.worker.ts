/**
 * GitHub Events Worker
 *
 * Processes GitHub webhook events enqueued by the web app's
 * /api/webhooks/github route. Runs on the control-plane.
 *
 * Handled events:
 *   pull_request (action: closed)
 *     - merged=true  → mark task as done, emit task.completed
 *     - merged=false → mark task as in_review, emit task.pr_closed_without_merge
 */

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { getRedisConnection } from "../db/redis.client";
import { getSupabaseClient } from "../db/supabase.client";
import { eventService } from "../events/event.service";
import { notificationService } from "../services/notification.service";
import { log } from "../utils/logger";

export const GITHUB_EVENTS_QUEUE_NAME = "github-events";

const SYSTEM_ACTOR = "github-webhook";

export type GitHubEventJobPayload = {
  event: string;
  deliveryId: string;
  payload: Record<string, unknown>;
};

// ─── Pull request payload types ───────────────────────────────────────────────

interface GitHubPullRequest {
  number: number;
  merged: boolean;
  html_url: string;
}

interface GitHubRepository {
  full_name: string;
}

interface PullRequestPayload {
  action: string;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
}

// ─── Core handler ─────────────────────────────────────────────────────────────

/**
 * handlePullRequestClosed — main entry point for pull_request:closed events.
 *
 * Looks up the task associated with the PR via task_events (agent.pr.opened).
 * Handles both merged and unmerged (closed) cases.
 */
export async function handlePullRequestClosed(
  payload: PullRequestPayload
): Promise<void> {
  const { pull_request: pr, repository } = payload;
  const prNumber = pr.number;
  const repoFullName = repository.full_name;
  const merged = pr.merged;

  log.info(
    { prNumber, repoFullName, merged },
    "handlePullRequestClosed: processing"
  );

  const db = getSupabaseClient();

  // ── 1. Resolve repository → get repository ID ─────────────────────────────
  const { data: repo, error: repoError } = await db
    .from("repositories")
    .select("id, workspace_id")
    .eq("full_name", repoFullName)
    .maybeSingle();

  if (repoError) {
    log.error({ repoFullName, error: repoError.message }, "handlePullRequestClosed: repo lookup failed");
    return;
  }

  if (!repo) {
    log.info({ repoFullName }, "handlePullRequestClosed: repository not managed by Robin — skipping");
    return;
  }

  const repositoryId = repo.id as string;
  const workspaceId = repo.workspace_id as string;

  // ── 2. Find the task via task_events (agent.pr.opened with matching pr_number) ──
  // First get all task IDs for this repository
  const { data: repoTasks, error: tasksError } = await db
    .from("tasks")
    .select("id")
    .eq("repository_id", repositoryId);

  if (tasksError) {
    log.error({ repositoryId, error: tasksError.message }, "handlePullRequestClosed: tasks lookup failed");
    return;
  }

  const taskIds = (repoTasks ?? []).map((t: { id: string }) => t.id);
  if (taskIds.length === 0) {
    log.info({ repoFullName }, "handlePullRequestClosed: no tasks for repository — skipping");
    return;
  }

  // Find the task_event where this PR was opened
  const { data: prEvent, error: eventError } = await db
    .from("task_events")
    .select("task_id")
    .eq("event_type", "agent.pr.opened")
    .filter("payload", "cs", JSON.stringify({ pr_number: prNumber }))
    .in("task_id", taskIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventError) {
    log.error({ prNumber, error: eventError.message }, "handlePullRequestClosed: event lookup failed");
    return;
  }

  if (!prEvent) {
    log.info(
      { prNumber, repoFullName },
      "handlePullRequestClosed: no task found for this PR — not managed by Robin"
    );
    return;
  }

  const taskId = prEvent.task_id as string;
  log.info({ taskId, prNumber, merged }, "handlePullRequestClosed: task found");

  // ── 3. Count iteration number (how many PRs have been opened for this task) ──
  const { count: iterationCount } = await db
    .from("task_events")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId)
    .eq("event_type", "agent.pr.opened");

  const iterationNumber = iterationCount ?? 1;

  // ── 4. Load task for notification ─────────────────────────────────────────
  const { data: task } = await db
    .from("tasks")
    .select("id, title, workspace_id, status")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    log.warn({ taskId }, "handlePullRequestClosed: task record not found after event lookup");
    return;
  }

  const taskInfo = {
    id: taskId,
    title: task.title as string,
    workspaceId: task.workspace_id as string,
  };

  // ── 5a. PR merged → mark task done ────────────────────────────────────────
  if (merged) {
    const { error: updateError } = await db
      .from("tasks")
      .update({
        status: "done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      log.error({ taskId, error: updateError.message }, "handlePullRequestClosed: failed to update task status to done");
      return;
    }

    await eventService.taskCompleted(
      taskId,
      workspaceId,
      SYSTEM_ACTOR,
      undefined,
      iterationNumber
    );

    await notificationService.notifyPrMerged(taskInfo, prNumber);

    log.info({ taskId, prNumber, iterationNumber }, "handlePullRequestClosed: task marked done (merged)");
    return;
  }

  // ── 5b. PR closed without merge → task back to in_review ─────────────────
  const { error: updateError } = await db
    .from("tasks")
    .update({
      status: "in_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (updateError) {
    log.error({ taskId, error: updateError.message }, "handlePullRequestClosed: failed to update task status to in_review");
    return;
  }

  await eventService.taskPrClosedWithoutMerge(
    taskId,
    workspaceId,
    SYSTEM_ACTOR,
    prNumber,
    iterationNumber
  );

  await notificationService.notifyPrClosedWithoutMerge(taskInfo, prNumber);

  log.info(
    { taskId, prNumber, iterationNumber },
    "handlePullRequestClosed: task returned to in_review (closed without merge)"
  );
}

// ─── Worker factory ───────────────────────────────────────────────────────────

async function processJob(job: Job<GitHubEventJobPayload>): Promise<void> {
  const { event, deliveryId, payload } = job.data;

  log.info({ jobId: job.id, event, deliveryId }, "GitHubEventsWorker: processing job");

  if (event === "pull_request") {
    const prPayload = payload as unknown as PullRequestPayload;
    const action = prPayload.action;

    if (action === "closed") {
      await handlePullRequestClosed(prPayload);
    } else {
      log.debug({ action }, "GitHubEventsWorker: pull_request action not handled");
    }
  } else if (event === "pull_request_review_comment") {
    // Inline diff comment — rework trigger (handler to be implemented)
    log.info({ deliveryId }, "GitHubEventsWorker: pull_request_review_comment received (not yet processed)");
  } else if (event === "issue_comment") {
    // General PR/issue comment — rework trigger (handler to be implemented)
    log.info({ deliveryId }, "GitHubEventsWorker: issue_comment received (not yet processed)");
  } else {
    log.debug({ event }, "GitHubEventsWorker: event not handled");
  }
}

export function createGitHubEventsWorker(): Worker<GitHubEventJobPayload> {
  const worker = new Worker<GitHubEventJobPayload>(
    GITHUB_EVENTS_QUEUE_NAME,
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: 5,
      stalledInterval: 30_000,
      maxStalledCount: 2,
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, event: job.data.event }, "GitHubEventsWorker: job completed");
  });

  worker.on("failed", (job, err) => {
    log.error(
      { jobId: job?.id, event: job?.data.event, error: err.message },
      "GitHubEventsWorker: job failed"
    );
  });

  worker.on("error", (err) => {
    log.error({ error: err.message }, "GitHubEventsWorker: worker error");
  });

  log.info({}, "GitHubEventsWorker started");
  return worker;
}
