import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRedis = {
  set: vi.fn(),
  eval: vi.fn(),
};

vi.mock("../db/redis.client", () => ({
  getRedisConnection: () => mockRedis,
}));

import {
  acquireRepoLock,
  releaseRepoLock,
  withRepoImplLock,
} from "../services/repo-lock";

beforeEach(() => {
  mockRedis.set.mockReset();
  mockRedis.eval.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("acquireRepoLock", () => {
  it("returns a token on successful SET NX", async () => {
    mockRedis.set.mockResolvedValue("OK");
    const token = await acquireRepoLock({ repositoryId: "r1", kind: "impl" });
    expect(token).not.toBeNull();
    expect(mockRedis.set).toHaveBeenCalledWith(
      "lock:repository:r1:impl",
      expect.any(String),
      "EX",
      3600,
      "NX"
    );
  });

  it("returns null when the lock is already held", async () => {
    mockRedis.set.mockResolvedValue(null);
    const token = await acquireRepoLock({ repositoryId: "r1", kind: "impl" });
    expect(token).toBeNull();
  });

  it("uses a custom TTL when provided", async () => {
    mockRedis.set.mockResolvedValue("OK");
    await acquireRepoLock({ repositoryId: "r1", kind: "maintenance", ttlSec: 30 });
    expect(mockRedis.set).toHaveBeenCalledWith(
      "lock:repository:r1:maintenance",
      expect.any(String),
      "EX",
      30,
      "NX"
    );
  });
});

describe("releaseRepoLock", () => {
  it("returns true when the Lua script reports a delete", async () => {
    mockRedis.eval.mockResolvedValue(1);
    const ok = await releaseRepoLock({ repositoryId: "r1", kind: "impl", token: "abc" });
    expect(ok).toBe(true);
  });

  it("returns false when the token no longer matches", async () => {
    mockRedis.eval.mockResolvedValue(0);
    const ok = await releaseRepoLock({ repositoryId: "r1", kind: "impl", token: "abc" });
    expect(ok).toBe(false);
  });

  it("swallows redis errors and returns false", async () => {
    mockRedis.eval.mockRejectedValue(new Error("conn lost"));
    const ok = await releaseRepoLock({ repositoryId: "r1", kind: "impl", token: "abc" });
    expect(ok).toBe(false);
  });
});

describe("withRepoImplLock", () => {
  it("runs the body and releases the lock on success", async () => {
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.eval.mockResolvedValue(1);

    const result = await withRepoImplLock("r1", async () => "value");

    expect(result).toEqual({ acquired: true, value: "value" });
    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it("releases even if the body throws", async () => {
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.eval.mockResolvedValue(1);

    await expect(
      withRepoImplLock("r1", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it("returns acquired:false without running the body when the lock is held", async () => {
    mockRedis.set.mockResolvedValue(null);
    const body = vi.fn();
    const result = await withRepoImplLock("r1", body);
    expect(result).toEqual({ acquired: false });
    expect(body).not.toHaveBeenCalled();
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });
});
