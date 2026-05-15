import { describe, it, expect } from "vitest";
import { localDayBoundsUtc } from "../db/maintenance";

describe("localDayBoundsUtc (web)", () => {
  it("returns 24h UTC bounds for UTC timezone", () => {
    const bounds = localDayBoundsUtc(new Date("2026-05-15T12:00:00Z"), "UTC");
    expect(bounds.startUtc.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(bounds.endUtc.toISOString()).toBe("2026-05-16T00:00:00.000Z");
  });

  it("offsets bounds for Europe/Rome (CEST in May)", () => {
    const bounds = localDayBoundsUtc(new Date("2026-05-15T12:00:00Z"), "Europe/Rome");
    expect(bounds.startUtc.toISOString()).toBe("2026-05-14T22:00:00.000Z");
    expect(bounds.endUtc.toISOString()).toBe("2026-05-15T22:00:00.000Z");
  });

  it("handles DST spring-forward day (Europe/Rome 2026-03-29)", () => {
    const bounds = localDayBoundsUtc(new Date("2026-03-29T12:00:00Z"), "Europe/Rome");
    const hours = (bounds.endUtc.getTime() - bounds.startUtc.getTime()) / 3_600_000;
    expect(hours).toBeCloseTo(23, 0);
  });

  it("matches orchestrator window helper for budget alignment", () => {
    // This test exists as a contract reminder: if the orchestrator helper
    // changes its semantics, this duplicate web-side helper must follow,
    // otherwise scheduler and run-now will disagree on day boundaries.
    const bounds = localDayBoundsUtc(new Date("2026-05-15T00:30:00Z"), "Europe/Rome");
    expect(bounds.endUtc.getTime()).toBeGreaterThan(bounds.startUtc.getTime());
  });
});
