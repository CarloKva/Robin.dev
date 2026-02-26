import { Redis } from "ioredis";

let _redis: Redis | null = null;

/** Singleton Redis connection shared by Queue and Worker. */
export function getRedisConnection(): Redis {
  if (_redis) return _redis;

  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("Missing REDIS_URL environment variable.");
  }

  _redis = new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,    // required by BullMQ
    lazyConnect: false,
  });

  _redis.on("error", (err) => {
    // Log but don't throw — ioredis handles reconnection automatically
    process.stderr.write(
      JSON.stringify({ level: "error", message: "Redis connection error", error: err.message }) + "\n"
    );
  });

  _redis.on("connect", () => {
    process.stdout.write(
      JSON.stringify({ level: "info", message: "Redis connected" }) + "\n"
    );
  });

  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
