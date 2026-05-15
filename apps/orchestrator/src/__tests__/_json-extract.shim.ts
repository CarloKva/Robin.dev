// Test-only shim for the JSON extraction heuristics used in
// maintenance-agent.runner.ts. The function is duplicated here verbatim so we
// can unit-test it without importing the full Claude Agent SDK chain.
//
// If the runner version of extractFinalJsonObject changes, update this shim to
// keep parity. The runner is the source of truth.

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function extractFinalJsonObject(text: string): unknown {
  if (!text) return null;

  const fenceMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  for (let i = fenceMatches.length - 1; i >= 0; i--) {
    const candidate = (fenceMatches[i]?.[1] ?? "").trim();
    const parsed = tryParseJson(candidate);
    if (parsed && typeof parsed === "object") return parsed;
  }

  let depth = 0;
  let start = -1;
  let lastObject: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        lastObject = text.slice(start, i + 1);
        start = -1;
      }
    }
  }

  if (!lastObject) return null;
  return tryParseJson(lastObject);
}

export const _testExports = { extractFinalJsonObject };
