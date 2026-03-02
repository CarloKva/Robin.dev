import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { BULL_BOARD_PORT } from "./config/bullmq.config";
import { taskQueue } from "./queues/task.queue";
import { createWorker, createQueueEventMonitor } from "./workers/task.worker";
import { createProvisioningWorker, resolveRedisUrlForAgents } from "./workers/agent.provisioning.worker";
import { createDeprovisioningWorker } from "./workers/agent.deprovisioning.worker";
import { reconstructRepoQueues, closeAllRepoWorkers } from "./workers/repo-queue.worker";
import { createSprintControlWorker } from "./workers/sprint-control.worker";
import { createGitHubEventsWorker } from "./workers/github-events.worker";
import { repoWatchdog } from "./services/repo-watchdog.service";
import { recoverPendingAgents } from "./services/provisioning-recovery.service";
import { SelfUpdateService } from "./services/self-update.service";
import { taskPoller } from "./services/task.poller";
import { HeartbeatService } from "./services/heartbeat.service";
import { closeRedis, getRedisConnection } from "./db/redis.client";
import { log } from "./utils/logger";

const AGENT_ID = process.env["AGENT_ID"] ?? "b0000000-0000-0000-0000-000000000001";
const VERSION = process.env["npm_package_version"] ?? "0.0.1";

/**
 * CONTROL_PLANE mode: runs provisioning/deprovisioning workers only.
 * Set CONTROL_PLANE=true on Carlo's control-plane VPS.
 * Agent VPSes leave this unset and run the task execution worker instead.
 */
const IS_CONTROL_PLANE = process.env["CONTROL_PLANE"] === "true";

async function main() {
  log.info(
    { version: VERSION, mode: IS_CONTROL_PLANE ? "control-plane" : "agent" },
    "Robin.dev Orchestrator starting"
  );

  // ─── Verify Redis connection ─────────────────────────────────────────────
  const redis = getRedisConnection();
  await redis.ping();
  log.info({}, "Redis connection verified");

  // ─── Mode-specific setup ─────────────────────────────────────────────────
  const workersToClose: Array<{ close: () => Promise<void> }> = [];
  let heartbeat: HeartbeatService | null = null;
  const selfUpdate = new SelfUpdateService(IS_CONTROL_PLANE);

  if (IS_CONTROL_PLANE) {
    // Fail fast if agent Redis URL config is missing (e.g. REDIS_AGENT_HOST not set)
    const agentRedisUrl = resolveRedisUrlForAgents();
    log.info({ agentRedisHost: new URL(agentRedisUrl.replace(/^rediss?:\/\//, "https://")).hostname }, "Agent Redis URL resolved");

    // Control-plane: provisioning + deprovisioning workers only (no task execution)
    const provisioningWorker = createProvisioningWorker();
    const deprovisioningWorker = createDeprovisioningWorker();
    workersToClose.push(provisioningWorker, deprovisioningWorker);

    // Reconstruct per-repo queues for tasks already queued at startup (idempotent)
    await reconstructRepoQueues();
    workersToClose.push({ close: closeAllRepoWorkers });

    // Fix 1: SprintControlWorker — activates per-repo workers on sprint start (<1s)
    const sprintControlWorker = createSprintControlWorker();
    workersToClose.push(sprintControlWorker);

    // Fix 2: RepoWatchdogService — periodic safety net every 60s
    repoWatchdog.start();

    // GitHub webhook events worker (processes pull_request:closed events)
    const gitHubEventsWorker = createGitHubEventsWorker();
    workersToClose.push(gitHubEventsWorker);

    log.info(
      {},
      "Control-plane workers started (provisioning + deprovisioning + repo-queues + sprint-control + watchdog + github-events)"
    );

    // Recover agents stuck in "pending" with no BullMQ job (fire-and-forget)
    recoverPendingAgents().catch((err) =>
      log.warn({ error: String(err) }, "Provisioning recovery check failed")
    );
  } else {
    // Agent VPS: validate AGENT_ID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(AGENT_ID)) {
      throw new Error(
        `AGENT_ID env var must be a valid UUID (got "${AGENT_ID}"). ` +
        "Set it to the agent's UUID from the agents table."
      );
    }

    const worker = createWorker();
    const queueEvents = createQueueEventMonitor(taskQueue);
    workersToClose.push(worker, queueEvents);

    heartbeat = new HeartbeatService(AGENT_ID, VERSION);
    heartbeat.start();

    taskPoller.start();

    log.info({}, "Agent workers started (task execution + heartbeat + poller)");
  }

  // ─── Self-update: listen for remote restart commands via Redis pub/sub ────
  await selfUpdate.start();

  // ─── Express: health endpoint + Bull Board ───────────────────────────────
  const app = express();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: IS_CONTROL_PLANE ? [] : [new BullMQAdapter(taskQueue.getBullMQQueue())],
    serverAdapter,
  });
  app.use("/admin/queues", serverAdapter.getRouter());

  // Health endpoint — polled by Betterstack and by waitForOrchestratorHealth()
  app.get("/health", async (_req, res) => {
    try {
      await redis.ping();
      const payload: Record<string, unknown> = {
        status: "ok",
        version: VERSION,
        mode: IS_CONTROL_PLANE ? "control-plane" : "agent",
        uptime: Math.round(process.uptime()),
        redisConnected: true,
      };

      if (!IS_CONTROL_PLANE) {
        payload["queueCounts"] = await taskQueue.getJobCounts();
      }

      res.json(payload);
    } catch (err) {
      res.status(503).json({
        status: "error",
        error: String(err),
        redisConnected: false,
      });
    }
  });

  // Control-plane listens on 0.0.0.0 (polled by provisioning health check).
  // Agent VPS listens on loopback only (health check is via SSH tunnel).
  const listenHost = IS_CONTROL_PLANE ? "0.0.0.0" : "127.0.0.1";

  const server = app.listen(BULL_BOARD_PORT, listenHost, () => {
    log.info(
      { port: BULL_BOARD_PORT, host: listenHost },
      `Health endpoint: http://${listenHost}:${BULL_BOARD_PORT}/health`
    );
    if (!IS_CONTROL_PLANE) {
      log.info(
        { port: BULL_BOARD_PORT },
        `Bull Board: http://127.0.0.1:${BULL_BOARD_PORT}/admin/queues`
      );
    }
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    log.info({ signal }, "Shutting down gracefully");

    heartbeat?.stop();
    await selfUpdate.stop();
    if (!IS_CONTROL_PLANE) taskPoller.stop();
    if (IS_CONTROL_PLANE) repoWatchdog.stop();

    // Give active jobs 30s to complete before forcing exit
    for (const w of workersToClose) {
      await w.close();
    }

    if (!IS_CONTROL_PLANE) {
      await taskQueue.close();
    } else {
      await closeAllRepoWorkers();
    }

    await closeRedis();

    server.close(() => {
      log.info({}, "HTTP server closed");
      process.exit(0);
    });

    // Force exit after 35s if graceful shutdown hangs
    setTimeout(() => {
      log.warn({}, "Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 35_000);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  log.info({}, "Robin.dev Orchestrator ready");
}

main().catch((err) => {
  process.stderr.write(
    JSON.stringify({ level: "error", message: "Fatal startup error", error: String(err) }) + "\n"
  );
  process.exit(1);
});
