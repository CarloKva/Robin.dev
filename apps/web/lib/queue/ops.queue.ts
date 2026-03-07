/**
 * BullMQ queues for the Ops Diagnostics Panel.
 * Enqueued by the web app; processed by the control-plane orchestrator.
 */

import { Queue } from "bullmq";
import type { OpsDiagnosticsJobPayload, OpsExecuteJobPayload } from "@robin/shared-types";
import { createRedisConnection } from "./redis.connection";

export const OPS_DIAGNOSTICS_QUEUE_NAME = "ops-diagnostics";
export const OPS_EXECUTE_QUEUE_NAME = "ops-execute";

let opsDiagnosticsQueue: Queue<OpsDiagnosticsJobPayload> | null = null;
let opsExecuteQueue: Queue<OpsExecuteJobPayload> | null = null;

export function getOpsDiagnosticsQueue(): Queue<OpsDiagnosticsJobPayload> {
  if (!opsDiagnosticsQueue) {
    opsDiagnosticsQueue = new Queue<OpsDiagnosticsJobPayload>(
      OPS_DIAGNOSTICS_QUEUE_NAME,
      {
        connection: createRedisConnection(),
        defaultJobOptions: {
          attempts: 1, // Ops runs are not retried automatically
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      }
    );
  }
  return opsDiagnosticsQueue;
}

export function getOpsExecuteQueue(): Queue<OpsExecuteJobPayload> {
  if (!opsExecuteQueue) {
    opsExecuteQueue = new Queue<OpsExecuteJobPayload>(
      OPS_EXECUTE_QUEUE_NAME,
      {
        connection: createRedisConnection(),
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      }
    );
  }
  return opsExecuteQueue;
}
