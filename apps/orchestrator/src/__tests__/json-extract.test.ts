import { describe, it, expect } from "vitest";

// Re-import via dynamic require to avoid pulling the whole Claude SDK chain
// at typecheck time. extractFinalJsonObject and tryParseJson are intentionally
// not exported; we test them through their public effect inside the runner by
// duplicating the contract in a tiny shim. Keeping this file as a regression
// suite for the JSON extraction heuristics.

import { _testExports } from "./_json-extract.shim";

const { extractFinalJsonObject } = _testExports;

describe("extractFinalJsonObject", () => {
  it("returns null for empty input", () => {
    expect(extractFinalJsonObject("")).toBeNull();
  });

  it("parses a single fenced JSON block", () => {
    const text = "Here is the result:\n```json\n{\"findings\": [], \"summary\": \"ok\"}\n```";
    expect(extractFinalJsonObject(text)).toEqual({ findings: [], summary: "ok" });
  });

  it("prefers the last fenced JSON block when multiple are present", () => {
    const text = '```json\n{"x": 1}\n```\nand later:\n```json\n{"x": 2}\n```';
    expect(extractFinalJsonObject(text)).toEqual({ x: 2 });
  });

  it("falls back to scanning braces when no fenced block is present", () => {
    const text = 'prelude {"a":1} interim {"b":2}';
    expect(extractFinalJsonObject(text)).toEqual({ b: 2 });
  });

  it("returns null when there is no balanced object", () => {
    expect(extractFinalJsonObject("just text { unbalanced")).toBeNull();
  });

  it("returns null when braces appear only inside strings without surrounding object", () => {
    expect(extractFinalJsonObject('the text "}" appears here')).toBeNull();
  });
});
