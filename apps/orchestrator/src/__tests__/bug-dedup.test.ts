import { describe, it, expect } from "vitest";
import { computeBugFindingDedupHash } from "../services/dedup";

const base = {
  repositoryId: "r1",
  title: "Checkout crashes when cart empty",
  source: "sentry",
  sourceRef: "ABCD-1234",
  severity: "P1",
};

describe("computeBugFindingDedupHash", () => {
  it("is deterministic for identical inputs", () => {
    expect(computeBugFindingDedupHash(base)).toBe(computeBugFindingDedupHash(base));
  });

  it("ignores cosmetic title differences", () => {
    expect(
      computeBugFindingDedupHash({
        ...base,
        title: "  CHECKOUT CRASHES   when CART empty   ",
      })
    ).toBe(computeBugFindingDedupHash(base));
  });

  it("changes when severity changes", () => {
    expect(
      computeBugFindingDedupHash({ ...base, severity: "P0" })
    ).not.toBe(computeBugFindingDedupHash(base));
  });

  it("changes when source_ref changes", () => {
    expect(
      computeBugFindingDedupHash({ ...base, sourceRef: "WXYZ-9999" })
    ).not.toBe(computeBugFindingDedupHash(base));
  });

  it("changes when source changes (sentry → static_analysis)", () => {
    expect(
      computeBugFindingDedupHash({ ...base, source: "static_analysis" })
    ).not.toBe(computeBugFindingDedupHash(base));
  });

  it("treats null source_ref as distinct from an explicit one", () => {
    expect(
      computeBugFindingDedupHash({ ...base, sourceRef: null })
    ).not.toBe(computeBugFindingDedupHash(base));
  });
});
