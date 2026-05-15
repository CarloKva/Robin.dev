import { describe, it, expect } from "vitest";
import {
  isInsideWindow,
  localDayBoundsUtc,
  nextRunAt,
} from "../scheduler/window";

describe("isInsideWindow", () => {
  it("returns true for always_on", () => {
    expect(
      isInsideWindow({ mode: "always_on", interval_minutes: 60 }, new Date(), "UTC")
    ).toBe(true);
  });

  it("returns false for disabled", () => {
    expect(isInsideWindow({ mode: "disabled" }, new Date(), "UTC")).toBe(false);
  });

  it("matches windows in workspace timezone", () => {
    // 2026-03-09 is a Monday; 14:00 UTC = 15:00 Europe/Rome (CET, no DST yet).
    const schedule = {
      mode: "windows" as const,
      interval_minutes: 60,
      windows: [{ weekday: "mon" as const, start: "09:00", end: "18:00" }],
    };
    expect(
      isInsideWindow(schedule, new Date("2026-03-09T14:00:00Z"), "Europe/Rome")
    ).toBe(true);
    expect(
      isInsideWindow(schedule, new Date("2026-03-09T22:00:00Z"), "Europe/Rome")
    ).toBe(false);
  });
});

describe("nextRunAt", () => {
  it("returns null when disabled", () => {
    expect(nextRunAt({ mode: "disabled" }, new Date(), "UTC")).toBeNull();
  });

  it("returns now + interval for always_on", () => {
    const now = new Date("2026-05-15T12:00:00Z");
    const next = nextRunAt({ mode: "always_on", interval_minutes: 60 }, now, "UTC");
    expect(next?.toISOString()).toBe("2026-05-15T13:00:00.000Z");
  });

  it("jumps to next active window when interval falls outside windows", () => {
    // Friday 17:00 UTC; window is Mon-Fri 09:00–18:00 Europe/Rome. Interval is
    // 6 hours so the candidate at 23:00 UTC is outside the Friday window and
    // should land in the Monday window.
    const now = new Date("2026-05-15T17:00:00Z");
    const schedule = {
      mode: "windows" as const,
      interval_minutes: 360,
      windows: [
        { weekday: "mon" as const, start: "09:00", end: "18:00" },
        { weekday: "tue" as const, start: "09:00", end: "18:00" },
        { weekday: "wed" as const, start: "09:00", end: "18:00" },
        { weekday: "thu" as const, start: "09:00", end: "18:00" },
        { weekday: "fri" as const, start: "09:00", end: "18:00" },
      ],
    };
    const next = nextRunAt(schedule, now, "Europe/Rome");
    expect(next).not.toBeNull();
    if (!next) return;
    // Expected to fall on or after Monday 2026-05-18 in Rome timezone.
    const isoDay = next.toISOString().slice(0, 10);
    expect(["2026-05-18"]).toContain(isoDay);
  });
});

describe("localDayBoundsUtc", () => {
  it("returns 24h UTC bounds for UTC timezone", () => {
    const bounds = localDayBoundsUtc(new Date("2026-05-15T12:00:00Z"), "UTC");
    expect(bounds.startUtc.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(bounds.endUtc.toISOString()).toBe("2026-05-16T00:00:00.000Z");
  });

  it("offsets bounds for Europe/Rome (CEST in May)", () => {
    // CEST = UTC+2 in May. Local day 2026-05-15 00:00 Rome = 2026-05-14 22:00 UTC.
    const bounds = localDayBoundsUtc(new Date("2026-05-15T12:00:00Z"), "Europe/Rome");
    expect(bounds.startUtc.toISOString()).toBe("2026-05-14T22:00:00.000Z");
    expect(bounds.endUtc.toISOString()).toBe("2026-05-15T22:00:00.000Z");
  });

  it("handles DST transition correctly (Europe/Rome spring forward 2026-03-29)", () => {
    // 2026-03-29 is the DST start in Europe/Rome (UTC+1 → UTC+2 at 02:00 local).
    // Day before should still be UTC+1.
    const dayBefore = localDayBoundsUtc(new Date("2026-03-28T15:00:00Z"), "Europe/Rome");
    expect(dayBefore.startUtc.toISOString()).toBe("2026-03-27T23:00:00.000Z");
    // The transition day itself has only 23 hours locally — UTC bounds should reflect that.
    const transitionDay = localDayBoundsUtc(
      new Date("2026-03-29T12:00:00Z"),
      "Europe/Rome"
    );
    const durationHours =
      (transitionDay.endUtc.getTime() - transitionDay.startUtc.getTime()) / 3_600_000;
    expect(durationHours).toBeCloseTo(23, 0);
  });
});
