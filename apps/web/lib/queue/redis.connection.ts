import IORedis, { type RedisOptions } from "ioredis";

/**
 * Creates a new ioredis connection from REDIS_URL.
 *
 * We parse the URL manually instead of passing it to ioredis directly
 * because ioredis's internal `rediss://` handling ignores user-provided
 * TLS options on some runtimes (notably Vercel's Node.js).
 */
export function createRedisConnection(): IORedis {
  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
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
  };

  if (isTls) {
    const caCert = process.env["REDIS_CA_CERT"];
    opts.tls = caCert ? { ca: caCert } : { rejectUnauthorized: false };
  }

  return new IORedis(opts);
}
