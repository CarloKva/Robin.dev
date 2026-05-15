import { randomBytes } from "crypto";
import { getRedisConnection } from "../db/redis.client";
import { log } from "../utils/logger";

const DEFAULT_LOCK_TTL_SEC = 60 * 60; // 1 hour — implementation runs are bounded but long.
const RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Per-repository mutation lock. AD-7 in the maintenance spec says
 * implementation maintenance jobs must share the same repository-level
 * mutation gate as normal task execution. We use a Redis SET NX EX with a
 * random token so the owner is the only one who can release it.
 *
 * Keys:
 *   - `lock:repository:<repository_id>:impl` — implementation runs.
 *   - `lock:repository:<repository_id>:maintenance` — discovery runs (reserved
 *     for the future; today discovery runs are read-only per same-repo, but
 *     this lock exists for callers who want explicit serialization).
 *
 * Use `withRepoImplLock(...)` for the common shape: acquire → run → release
 * even on failure. The release script is atomic against TTL expiry so a slow
 * runner that lost its lock won't accidentally delete the next holder's.
 */
export type RepoLockKind = "impl" | "maintenance";

function lockKey(repositoryId: string, kind: RepoLockKind): string {
  return `lock:repository:${repositoryId}:${kind}`;
}

export async function acquireRepoLock(args: {
  repositoryId: string;
  kind: RepoLockKind;
  ttlSec?: number;
}): Promise<string | null> {
  const redis = getRedisConnection();
  const token = randomBytes(16).toString("hex");
  const ttl = args.ttlSec ?? DEFAULT_LOCK_TTL_SEC;
  const key = lockKey(args.repositoryId, args.kind);
  const result = await redis.set(key, token, "EX", ttl, "NX");
  return result === "OK" ? token : null;
}

export async function releaseRepoLock(args: {
  repositoryId: string;
  kind: RepoLockKind;
  token: string;
}): Promise<boolean> {
  const redis = getRedisConnection();
  const key = lockKey(args.repositoryId, args.kind);
  try {
    const result = (await redis.eval(RELEASE_LUA, 1, key, args.token)) as number;
    return result === 1;
  } catch (err) {
    log.warn(
      { repositoryId: args.repositoryId, kind: args.kind, error: String(err) },
      "repo-lock: release failed"
    );
    return false;
  }
}

/**
 * Try to acquire the impl lock; run the body; release in finally. Returns
 * `{ acquired: false }` if the lock is held by someone else — caller should
 * treat that as a transient retry signal, not a fatal error.
 */
export async function withRepoImplLock<T>(
  repositoryId: string,
  body: () => Promise<T>,
  opts: { ttlSec?: number } = {}
): Promise<{ acquired: true; value: T } | { acquired: false }> {
  const token = await acquireRepoLock({
    repositoryId,
    kind: "impl",
    ...(opts.ttlSec !== undefined ? { ttlSec: opts.ttlSec } : {}),
  });
  if (!token) return { acquired: false };
  try {
    const value = await body();
    return { acquired: true, value };
  } finally {
    await releaseRepoLock({ repositoryId, kind: "impl", token });
  }
}
