/**
 * SelfUpdateService — listens for commands on Redis pub/sub channels.
 *
 * Channels:
 *   `robin:update`         — all instances restart (start.sh pulls + rebuilds)
 *   `robin:bake-snapshot`  — control-plane only: triggers a snapshot bake
 */

import { Redis } from "ioredis";
import { getRedisConnection } from "../db/redis.client";
import { log } from "../utils/logger";

export const UPDATE_CHANNEL = "robin:update";
const BAKE_CHANNEL = "robin:bake-snapshot";

export class SelfUpdateService {
  private subscriber: Redis | null = null;
  private readonly isControlPlane: boolean;

  constructor(isControlPlane: boolean) {
    this.isControlPlane = isControlPlane;
  }

  async start(): Promise<void> {
    const mainRedis = getRedisConnection();
    this.subscriber = mainRedis.duplicate();

    this.subscriber.on("error", (err) => {
      log.warn({ error: err.message }, "SelfUpdate subscriber error");
    });

    const channels = [UPDATE_CHANNEL];
    if (this.isControlPlane) channels.push(BAKE_CHANNEL);

    await this.subscriber.subscribe(...channels);

    this.subscriber.on("message", (channel, message) => {
      if (channel === UPDATE_CHANNEL) {
        log.info({ message }, "Self-update command received — restarting to pull latest code");
        setTimeout(() => process.exit(0), 2_000);
      }

      if (channel === BAKE_CHANNEL && this.isControlPlane) {
        log.info({ message }, "Snapshot bake command received");
        void this.handleBake();
      }
    });

    log.info(
      { channels },
      "SelfUpdateService listening"
    );
  }

  private async handleBake(): Promise<void> {
    try {
      const { bakeSnapshot } = await import("./snapshot-baker.service");
      const { snapshotId } = await bakeSnapshot();
      log.info({ snapshotId }, "Snapshot bake complete — set HETZNER_SNAPSHOT_ID to use it");
    } catch (err) {
      log.error({ error: err instanceof Error ? err.message : String(err) }, "Snapshot bake failed");
    }
  }

  async stop(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}
