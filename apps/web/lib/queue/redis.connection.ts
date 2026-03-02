import IORedis, { type RedisOptions } from "ioredis";
import type { ConnectionOptions as TlsOptions } from "node:tls";

function buildTlsOptions(url: string): TlsOptions | undefined {
  if (!url.startsWith("rediss://")) return undefined;

  const caCert = process.env["REDIS_CA_CERT"];
  if (caCert) return { ca: caCert };
  return { rejectUnauthorized: false };
}

/**
 * Creates a new ioredis connection from REDIS_URL.
 * Passing the URL as constructor argument (not as options property)
 * ensures that `rediss://` (TLS) URLs are handled correctly.
 *
 * For self-signed TLS certs, set REDIS_CA_CERT to the PEM-encoded CA
 * certificate. If omitted, certificate verification is disabled.
 */
export function createRedisConnection(): IORedis {
  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  const opts: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  const tls = buildTlsOptions(url);
  if (tls) opts.tls = tls;

  return new IORedis(url, opts);
}
