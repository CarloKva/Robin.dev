import { Queue } from "bullmq";
import type { MaintenanceJobPayload } from "@robin/shared-types";
import { createRedisConnection } from "./redis.connection";

const MAINTENANCE_QUEUE_NAME = "maintenance-agents";

let _queue: Queue<MaintenanceJobPayload> | null = null;

/**
 * Singleton BullMQ Queue the web app uses to enqueue manual ("Run Now")
 * maintenance jobs. The orchestrator maintenance worker listens to the same
 * queue name on the same Redis instance.
 */
export function getMaintenanceQueue(): Queue<MaintenanceJobPayload> {
  if (_queue) return _queue;

  _queue = new Queue<MaintenanceJobPayload>(MAINTENANCE_QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 0 },
      removeOnFail: { count: 100 },
    },
  });

  return _queue;
}

export { MAINTENANCE_QUEUE_NAME };
