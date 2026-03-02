import { Redis, type RedisOptions } from "ioredis";
import type { ConnectionOptions as TlsOptions } from "node:tls";

let _redis: Redis | null = null;

function buildTlsOptions(url: string): TlsOptions | undefined {
  if (!url.startsWith("rediss://")) return undefined;

  const caCert = process.env["REDIS_CA_CERT"];
  if (caCert) return { ca: caCert };
  return { rejectUnauthorized: false };
}

/**
 * Singleton Redis connection shared by Queue and Worker.
 *
 * For self-signed TLS certs, set REDIS_CA_CERT to the PEM-encoded CA
 * certificate. If omitted, certificate verification is disabled.
 */
export function getRedisConnection(): Redis {
  if (_redis) return _redis;

  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("Missing REDIS_URL environment variable.");
  }

  const opts: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  };

  const tls = buildTlsOptions(url);
  if (tls) opts.tls = tls;

  _redis = new Redis(url, opts);

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
