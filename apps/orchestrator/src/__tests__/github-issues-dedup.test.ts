import { describe, it, expect } from "vitest";
import {
  findMatchingIssue,
  normalizeTitle,
  titleCosineSimilarity,
} from "../services/github-issues.service";

describe("normalizeTitle", () => {
  it("strips priority tags", () => {
    expect(normalizeTitle("[P1] Checkout breaks")).toBe("checkout breaks");
    expect(normalizeTitle("P0: payments fail")).toBe("payments fail");
  });

  it("lowercases and collapses whitespace + punctuation", () => {
    expect(normalizeTitle("  Hello,   World!! ")).toBe("hello world");
  });
});

describe("titleCosineSimilarity", () => {
  it("returns 1 for identical titles", () => {
    expect(titleCosineSimilarity("checkout breaks", "checkout breaks")).toBeCloseTo(1);
  });

  it("returns ~0 for unrelated titles", () => {
    expect(
      titleCosineSimilarity("checkout breaks on mobile", "calendar export fails")
    ).toBeLessThan(0.5);
  });

  it("matches near-duplicates above the documented 0.82 threshold", () => {
    expect(
      titleCosineSimilarity(
        "Checkout crashes when cart is empty",
        "Crash on checkout when cart empty"
      )
    ).toBeGreaterThanOrEqual(0.82);
  });
});

describe("findMatchingIssue", () => {
  const issues = [
    {
      number: 42,
      title: "[P1] Checkout crashes when cart is empty",
      body: "Stack trace ABCD-1234 from Sentry",
      url: "https://github.com/x/y/issues/42",
    },
    {
      number: 51,
      title: "Calendar export fails on Safari",
      body: "Different issue",
      url: "https://github.com/x/y/issues/51",
    },
  ];

  it("matches by exact normalized title", () => {
    const match = findMatchingIssue({
      finding: {
        title: "Checkout crashes when cart is empty",
        source_ref: null,
      },
      issues,
    });
    expect(match?.reason).toBe("exact_title");
    expect(match?.issue.number).toBe(42);
  });

  it("matches by Sentry source_ref appearing in issue body", () => {
    const match = findMatchingIssue({
      finding: {
        title: "Some other phrasing",
        source_ref: "ABCD-1234",
      },
      issues,
    });
    expect(match?.reason).toBe("sentry_source_ref");
  });

  it("matches by cosine similarity above 0.82", () => {
    const match = findMatchingIssue({
      finding: {
        title: "Crash on checkout when cart empty",
        source_ref: null,
      },
      issues,
    });
    expect(match?.reason).toBe("cosine_title");
  });

  it("returns null when nothing matches", () => {
    const match = findMatchingIssue({
      finding: {
        title: "Pricing page typo",
        source_ref: null,
      },
      issues,
    });
    expect(match).toBeNull();
  });
});
