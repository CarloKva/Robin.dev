import { describe, it, expect } from "vitest";
import {
  computeSpecFindingDedupHash,
  normalizeRequirement,
} from "../services/dedup";

describe("normalizeRequirement", () => {
  it("collapses whitespace and lowercases", () => {
    expect(normalizeRequirement("  Hello   World  ")).toBe("hello world");
  });

  it("normalizes smart quotes", () => {
    expect(normalizeRequirement("‘foo’")).toBe("'foo'");
    expect(normalizeRequirement("“foo”")).toBe("'foo'");
  });
});

describe("computeSpecFindingDedupHash", () => {
  const base = {
    repositoryId: "r1",
    sourcePath: "docs/spec.md",
    sourceLine: 42,
    requirementText: "User must be able to log in",
    status: "missing",
  };

  it("is deterministic for identical inputs", () => {
    expect(computeSpecFindingDedupHash(base)).toBe(computeSpecFindingDedupHash(base));
  });

  it("ignores cosmetic whitespace and case differences", () => {
    const a = computeSpecFindingDedupHash(base);
    const b = computeSpecFindingDedupHash({
      ...base,
      requirementText: "  USER must  be able to LOG IN  ",
    });
    expect(a).toBe(b);
  });

  it("changes when status changes", () => {
    expect(computeSpecFindingDedupHash(base)).not.toBe(
      computeSpecFindingDedupHash({ ...base, status: "partial" })
    );
  });

  it("changes when source line changes", () => {
    expect(computeSpecFindingDedupHash(base)).not.toBe(
      computeSpecFindingDedupHash({ ...base, sourceLine: 43 })
    );
  });

  it("treats null source line as distinct from a numeric line", () => {
    expect(computeSpecFindingDedupHash({ ...base, sourceLine: null })).not.toBe(
      computeSpecFindingDedupHash(base)
    );
  });
});
