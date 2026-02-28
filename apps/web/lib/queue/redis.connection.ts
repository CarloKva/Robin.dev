import IORedis from "ioredis";

/**
 * Creates a new ioredis connection from REDIS_URL.
 * Passing the URL as constructor argument (not as options property)
 * ensures that `rediss://` (TLS) URLs are handled correctly.
 */
export function createRedisConnection(): IORedis {
  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
