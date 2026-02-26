import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { BULL_BOARD_PORT } from "./config/bullmq.config";
import { taskQueue } from "./queues/task.queue";
import { createWorker, createQueueEventMonitor } from "./workers/task.worker";
import { taskPoller } from "./services/task.poller";
import { closeRedis, getRedisConnection } from "./db/redis.client";
import { log } from "./utils/logger";

const VERSION = process.env["npm_package_version"] ?? "0.0.1";

async function main() {
  log.info({ version: VERSION }, "Robin.dev Orchestrator starting");

  // -------------------------
  // Verify Redis connection
  // -------------------------
  const redis = getRedisConnection();
  await redis.ping();
  log.info({}, "Redis connection verified");

  // -------------------------
  // Start worker + queue events monitor
  // -------------------------
  const worker = createWorker();
  const queueEvents = createQueueEventMonitor(taskQueue);

  // -------------------------
  // Start poller
  // -------------------------
  taskPoller.start();

  // -------------------------
  // Express: health endpoint + Bull Board
  // -------------------------
  const app = express();

  // Bull Board UI — accessible via SSH tunnel: ssh -L 3001:localhost:3001 agent@<vps>
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(taskQueue.getBullMQQueue())],
    serverAdapter,
  });
  app.use("/admin/queues", serverAdapter.getRouter());

  // Health endpoint — polled by Betterstack
  app.get("/health", async (_req, res) => {
    try {
      await redis.ping();
      const queueCounts = await taskQueue.getJobCounts();

      res.json({
        status: "ok",
        version: VERSION,
        uptime: Math.round(process.uptime()),
        queueCounts,
        redisConnected: true,
      });
    } catch (err) {
      res.status(503).json({
        status: "error",
        error: String(err),
        redisConnected: false,
      });
    }
  });

  const server = app.listen(BULL_BOARD_PORT, "127.0.0.1", () => {
    log.info(
      { port: BULL_BOARD_PORT },
      `Health endpoint: http://127.0.0.1:${BULL_BOARD_PORT}/health`
    );
    log.info(
      { port: BULL_BOARD_PORT },
      `Bull Board: http://127.0.0.1:${BULL_BOARD_PORT}/admin/queues`
    );
  });

  // -------------------------
  // Graceful shutdown
  // -------------------------
  const shutdown = async (signal: string) => {
    log.info({ signal }, "Shutting down gracefully");

    taskPoller.stop();

    // Give active jobs 30s to complete before forcing exit
    await worker.close();
    await queueEvents.close();
    await taskQueue.close();
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

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  log.info({}, "Robin.dev Orchestrator ready");
}

main().catch((err) => {
  process.stderr.write(
    JSON.stringify({ level: "error", message: "Fatal startup error", error: String(err) }) + "\n"
  );
  process.exit(1);
});
