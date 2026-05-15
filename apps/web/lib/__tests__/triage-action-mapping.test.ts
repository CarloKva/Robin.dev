import { describe, it, expect } from "vitest";
import { TRIAGE_ACTION_TO_STATE } from "../db/maintenance";

describe("TRIAGE_ACTION_TO_STATE", () => {
  it("maps approve → approved", () => {
    expect(TRIAGE_ACTION_TO_STATE.approve).toBe("approved");
  });

  it("maps reject → rejected", () => {
    expect(TRIAGE_ACTION_TO_STATE.reject).toBe("rejected");
  });

  it("maps snooze → snoozed", () => {
    expect(TRIAGE_ACTION_TO_STATE.snooze).toBe("snoozed");
  });

  it("maps mark_implemented → implemented", () => {
    expect(TRIAGE_ACTION_TO_STATE.mark_implemented).toBe("implemented");
  });

  it("covers exactly the four documented actions", () => {
    expect(Object.keys(TRIAGE_ACTION_TO_STATE).sort()).toEqual([
      "approve",
      "mark_implemented",
      "reject",
      "snooze",
    ]);
  });
});
