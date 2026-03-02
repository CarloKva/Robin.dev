import { Redis, type RedisOptions } from "ioredis";

let _redis: Redis | null = null;

/**
 * Singleton Redis connection shared by Queue and Worker.
 *
 * We parse REDIS_URL manually instead of passing it to ioredis directly
 * because ioredis's internal `rediss://` handling ignores user-provided
 * TLS options on some runtimes (notably Vercel's Node.js).
 */
export function getRedisConnection(): Redis {
  if (_redis) return _redis;

  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("Missing REDIS_URL environment variable.");
  }

  const parsed = new URL(url);
  const isTls = parsed.protocol === "rediss:";

  const opts: RedisOptions = {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    ...(parsed.password && { password: decodeURIComponent(parsed.password) }),
    ...(parsed.username && parsed.username !== "default" && {
      username: decodeURIComponent(parsed.username),
    }),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  };

  if (isTls) {
    const caCert = process.env["REDIS_CA_CERT"];
    opts.tls = caCert ? { ca: caCert } : { rejectUnauthorized: false };
  }

  _redis = new Redis(opts);

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
