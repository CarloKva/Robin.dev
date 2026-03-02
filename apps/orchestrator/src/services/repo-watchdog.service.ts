import { reconstructRepoQueues } from "../workers/repo-queue.worker";
import { log } from "../utils/logger";

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

/**
 * RepoWatchdogService — Fix 2: periodic safety net.
 *
 * Runs only on the control-plane. Every 60 seconds it calls
 * `reconstructRepoQueues()`, which is fully idempotent:
 *   - Scans the DB for tasks with status='queued' and sprint_id IS NOT NULL
 *   - Creates per-repo BullMQ workers for any repository that doesn't have one
 *   - Re-enqueues BullMQ jobs (via idempotent jobId) for any task whose job
 *     was lost (e.g. Redis restart, BullMQ enqueue failure at sprint start)
 *
 * This covers every failure mode that the SprintControlWorker (Fix 1) cannot:
 *   - Redis was temporarily unavailable when the sprint was started
 *   - The sprint-control job itself was lost
 *   - The control-plane restarted between sprint start and job processing
 *   - Any other silent failure in the happy path
 *
 * Maximum staleness: 60 seconds. In practice, Fix 1 handles the common case
 * in under a second; this service only activates when something went wrong.
 */
export class RepoWatchdogService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;

    // Run immediately so stale queued tasks from before this startup are covered
    this.runScan();

    this.timer = setInterval(() => {
      this.runScan();
    }, POLL_INTERVAL_MS);

    log.info({ intervalMs: POLL_INTERVAL_MS }, "RepoWatchdogService started");
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info({}, "RepoWatchdogService stopped");
  }

  private runScan(): void {
    reconstructRepoQueues().catch((err) => {
      log.error({ error: String(err) }, "RepoWatchdog scan threw");
    });
  }
}

export const repoWatchdog = new RepoWatchdogService();
