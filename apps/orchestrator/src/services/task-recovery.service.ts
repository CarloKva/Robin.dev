/**
 * TaskRecoveryService — periodic recovery for orphaned tasks.
 *
 * When systemd restarts the agent while a BullMQ job is active, the job is
 * dropped but the DB row stays in `in_progress` or `queued` with
 * `queued_at IS NOT NULL`. The task poller skips these rows (it filters
 * `queued_at IS NULL`), leaving tasks stuck forever.
 *
 * Every RECOVERY_INTERVAL_MS this service:
 *   1. Finds tasks assigned to this agent with status in_progress/queued and
 *      queued_at older than ORPHAN_THRESHOLD_MS.
 *   2. For each candidate, checks whether a BullMQ job still exists.
 *   3. If the job is gone → resets the task to pending so the poller re-queues it.
 *
 * See BUG-ORC-03 in apps/orchestrator/CLAUDE.md.
 */

import { taskRepository } from "../repositories/task.repository";
import { taskQueue } from "../queues/task.queue";
import { log } from "../utils/logger";

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export class TaskRecoveryService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  start(): void {
    // Run once at startup to catch tasks orphaned during the previous restart
    this.recover().catch((err) =>
      log.warn({ error: String(err) }, "TaskRecoveryService: startup recovery failed")
    );

    this.timer = setInterval(() => {
      this.recover().catch((err) =>
        log.warn({ error: String(err) }, "TaskRecoveryService: periodic recovery failed")
      );
    }, RECOVERY_INTERVAL_MS);

    log.info({ intervalMs: RECOVERY_INTERVAL_MS, thresholdMs: ORPHAN_THRESHOLD_MS }, "TaskRecoveryService started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info({}, "TaskRecoveryService stopped");
  }

  private async recover(): Promise<void> {
    const candidates = await taskRepository.getOrphanedCandidates(this.agentId, ORPHAN_THRESHOLD_MS);

    if (!candidates.length) return;

    log.info({ count: candidates.length }, "TaskRecoveryService: checking orphan candidates");

    const bullQueue = taskQueue.getBullMQQueue();

    for (const task of candidates) {
      const job = await bullQueue.getJob(task.id);

      if (job) {
        const state = await job.getState();
        log.debug({ taskId: task.id, jobState: state }, "TaskRecoveryService: job exists, skipping");
        continue;
      }

      log.warn(
        { taskId: task.id, title: task.title, status: task.status },
        "TaskRecoveryService: orphaned task found — resetting to pending"
      );
      await taskRepository.resetOrphanedTask(task.id);
    }
  }
}
