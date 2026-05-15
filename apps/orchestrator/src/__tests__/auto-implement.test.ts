import { describe, it, expect } from "vitest";
import { isEligibleForAutoImplement } from "../services/auto-implement.service";

describe("isEligibleForAutoImplement", () => {
  it("allows spec findings only when status=missing", () => {
    expect(isEligibleForAutoImplement("spec", "missing")).toBe(true);
    expect(isEligibleForAutoImplement("spec", "partial")).toBe(false);
    expect(isEligibleForAutoImplement("spec", "drifted")).toBe(false);
    expect(isEligibleForAutoImplement("spec", "implemented")).toBe(false);
  });

  it("allows bug findings only at P2 or P3", () => {
    expect(isEligibleForAutoImplement("bug", "P0")).toBe(false);
    expect(isEligibleForAutoImplement("bug", "P1")).toBe(false);
    expect(isEligibleForAutoImplement("bug", "P2")).toBe(true);
    expect(isEligibleForAutoImplement("bug", "P3")).toBe(true);
  });

  it("rejects unknown status / severity values", () => {
    expect(isEligibleForAutoImplement("spec", "")).toBe(false);
    expect(isEligibleForAutoImplement("bug", "P99")).toBe(false);
    expect(isEligibleForAutoImplement("spec", "MISSING")).toBe(false);
  });
});
