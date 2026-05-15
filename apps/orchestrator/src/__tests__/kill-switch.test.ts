import { describe, it, expect } from "vitest";
import {
  KILL_SWITCH_THRESHOLDS,
  startOfWeekUtc,
} from "../scheduler/maintenance-kill-switch";

describe("KILL_SWITCH_THRESHOLDS", () => {
  it("matches the values documented in the spec", () => {
    expect(KILL_SWITCH_THRESHOLDS.FP_RATE).toBe(0.3);
    expect(KILL_SWITCH_THRESHOLDS.PR_MERGE_RATE).toBe(0.5);
    expect(KILL_SWITCH_THRESHOLDS.COST_PER_MERGED_PR_USD).toBe(20);
    expect(KILL_SWITCH_THRESHOLDS.CONSECUTIVE_BREACH_WEEKS).toBe(2);
  });
});

describe("startOfWeekUtc", () => {
  it("returns the Monday 00:00 UTC of the week", () => {
    // 2026-05-15 is a Friday. Monday of that ISO week is 2026-05-11.
    const monday = startOfWeekUtc(new Date("2026-05-15T12:00:00Z"));
    expect(monday.toISOString()).toBe("2026-05-11T00:00:00.000Z");
  });

  it("returns the same Monday when called on Monday", () => {
    const monday = startOfWeekUtc(new Date("2026-05-11T08:30:00Z"));
    expect(monday.toISOString()).toBe("2026-05-11T00:00:00.000Z");
  });

  it("rolls back to the previous Monday on Sunday", () => {
    // 2026-05-17 is a Sunday — the week starts on 2026-05-11.
    const monday = startOfWeekUtc(new Date("2026-05-17T23:59:59Z"));
    expect(monday.toISOString()).toBe("2026-05-11T00:00:00.000Z");
  });
});
