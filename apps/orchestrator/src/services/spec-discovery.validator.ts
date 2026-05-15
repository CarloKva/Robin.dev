import * as fs from "fs";
import * as path from "path";

export type RawSpecFinding = {
  requirement_text?: unknown;
  requirement_source_path?: unknown;
  requirement_source_line?: unknown;
  requirement_source_end_line?: unknown;
  status?: unknown;
  evidence_paths?: unknown;
  suggested_action?: unknown;
  confidence?: unknown;
};

export type ValidatedSpecFinding = {
  requirement_text: string;
  requirement_source_path: string;
  requirement_source_line: number | null;
  requirement_source_end_line: number | null;
  status: "implemented" | "partial" | "missing" | "drifted";
  evidence_paths: string[];
  suggested_action: string | null;
  confidence: number;
};

export type SpecDiscoveryRawOutput = {
  findings?: unknown;
  summary?: unknown;
  tokens_used?: unknown;
  cost_usd?: unknown;
};

export type SpecDiscoveryValidatedOutput = {
  findings: ValidatedSpecFinding[];
  summary: string;
  tokens_used: number;
  cost_usd: number;
};

export type ValidatorOptions = {
  repoPath: string;
  specPaths: string[];
  protectedPaths: string[];
  confidenceFloor?: number;
  maxFindings?: number;
};

export type ValidationResult = {
  output: SpecDiscoveryValidatedOutput;
  dropped: Array<{ reason: string; finding: RawSpecFinding }>;
};

const VALID_STATUSES = new Set(["implemented", "partial", "missing", "drifted"]);
const DEFAULT_CONFIDENCE_FLOOR = 0.5;
const DEFAULT_MAX_FINDINGS = 50;

/**
 * Validate the JSON emitted by the spec_discovery Claude run against the
 * runner-enforced rules. Returns a normalized output object plus a list of
 * dropped findings with the reason each was rejected.
 *
 * Top-level shape errors throw — they indicate the model failed the contract.
 * Per-finding rule failures drop the finding silently and are returned for
 * observability in the agent run record.
 */
export function validateSpecDiscoveryOutput(
  raw: SpecDiscoveryRawOutput,
  opts: ValidatorOptions
): ValidationResult {
  const confidenceFloor = opts.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;
  const maxFindings = opts.maxFindings ?? DEFAULT_MAX_FINDINGS;

  if (!raw || typeof raw !== "object") {
    throw new Error("spec-discovery validator: output is not an object");
  }

  if (!Array.isArray(raw.findings)) {
    throw new Error("spec-discovery validator: `findings` must be an array");
  }

  if (typeof raw.summary !== "string") {
    throw new Error("spec-discovery validator: `summary` must be a string");
  }

  const tokensUsed = toNonNegativeInt(raw.tokens_used);
  if (tokensUsed === null) {
    throw new Error("spec-discovery validator: `tokens_used` must be a non-negative integer");
  }

  const costUsd = toNonNegativeNumber(raw.cost_usd);
  if (costUsd === null) {
    throw new Error("spec-discovery validator: `cost_usd` must be a non-negative number");
  }

  const specPathSet = new Set(opts.specPaths.map((p) => normalizePath(p)));
  const protectedGlobs = opts.protectedPaths.map((p) => p.trim()).filter(Boolean);

  const validated: ValidatedSpecFinding[] = [];
  const dropped: Array<{ reason: string; finding: RawSpecFinding }> = [];

  for (const rawFinding of raw.findings as RawSpecFinding[]) {
    const verdict = validateFinding(rawFinding, {
      specPathSet,
      protectedGlobs,
      repoPath: opts.repoPath,
      confidenceFloor,
    });

    if (verdict.kind === "drop") {
      dropped.push({ reason: verdict.reason, finding: rawFinding });
      continue;
    }

    validated.push(verdict.finding);
  }

  // Cap at maxFindings, keeping highest-confidence first.
  validated.sort((a, b) => b.confidence - a.confidence);
  const capped = validated.slice(0, maxFindings);
  if (validated.length > maxFindings) {
    for (const overflow of validated.slice(maxFindings)) {
      dropped.push({ reason: "max_findings_cap_exceeded", finding: overflow });
    }
  }

  return {
    output: {
      findings: capped,
      summary: raw.summary as string,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
    },
    dropped,
  };
}

type FindingValidationCtx = {
  specPathSet: Set<string>;
  protectedGlobs: string[];
  repoPath: string;
  confidenceFloor: number;
};

type FindingVerdict =
  | { kind: "keep"; finding: ValidatedSpecFinding }
  | { kind: "drop"; reason: string };

function validateFinding(raw: RawSpecFinding, ctx: FindingValidationCtx): FindingVerdict {
  if (!raw || typeof raw !== "object") {
    return { kind: "drop", reason: "finding_not_object" };
  }

  const text = typeof raw.requirement_text === "string" ? raw.requirement_text.trim() : "";
  if (!text) return { kind: "drop", reason: "missing_requirement_text" };

  const sourcePath = typeof raw.requirement_source_path === "string"
    ? normalizePath(raw.requirement_source_path.trim())
    : "";
  if (!sourcePath) return { kind: "drop", reason: "missing_source_path" };
  if (!ctx.specPathSet.has(sourcePath)) {
    return { kind: "drop", reason: "source_path_not_in_spec_paths" };
  }
  if (isProtectedPath(sourcePath, ctx.protectedGlobs)) {
    return { kind: "drop", reason: "source_path_protected" };
  }

  const status = typeof raw.status === "string" ? raw.status : "";
  if (!VALID_STATUSES.has(status)) {
    return { kind: "drop", reason: "invalid_status" };
  }

  const confidence = typeof raw.confidence === "number" ? raw.confidence : NaN;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { kind: "drop", reason: "invalid_confidence" };
  }
  if (confidence < ctx.confidenceFloor) {
    return { kind: "drop", reason: "confidence_below_floor" };
  }

  const sourceLine = toPositiveInt(raw.requirement_source_line);
  const sourceEndLine = toPositiveInt(raw.requirement_source_end_line);

  const evidenceRaw = Array.isArray(raw.evidence_paths) ? raw.evidence_paths : [];
  const evidence: string[] = [];
  for (const value of evidenceRaw) {
    if (typeof value !== "string") continue;
    const normalized = normalizePath(value.trim());
    if (!normalized) continue;
    if (isProtectedPath(normalized, ctx.protectedGlobs)) {
      return { kind: "drop", reason: "evidence_path_protected" };
    }
    evidence.push(normalized);
  }

  if (sourceLine !== null) {
    const anchored = sourceLineAnchorsRequirement({
      repoPath: ctx.repoPath,
      sourcePath,
      sourceLine,
      sourceEndLine,
      requirementText: text,
    });
    if (!anchored) {
      return { kind: "drop", reason: "source_line_does_not_anchor_requirement" };
    }
  }

  const suggestedAction =
    typeof raw.suggested_action === "string" && raw.suggested_action.trim().length > 0
      ? raw.suggested_action.trim()
      : null;

  return {
    kind: "keep",
    finding: {
      requirement_text: text,
      requirement_source_path: sourcePath,
      requirement_source_line: sourceLine,
      requirement_source_end_line: sourceEndLine,
      status: status as ValidatedSpecFinding["status"],
      evidence_paths: evidence,
      suggested_action: suggestedAction,
      confidence,
    },
  };
}

function normalizePath(value: string): string {
  return value.replace(/^\.\//, "").replace(/^\/+/, "").replace(/\\/g, "/");
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

function toNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
}

/**
 * Minimal glob matcher: supports the patterns we ship in `protected_paths`:
 *   - `.env*`               (single segment, * matches anything but `/`)
 *   - `supabase/migrations/**`   (recursive)
 *   - `.github/workflows/**`     (recursive)
 *
 * Not a general-purpose glob. Designed to fail closed (return true) only on
 * patterns it actually understands; everything else falls back to literal
 * prefix or equality match.
 */
export function isProtectedPath(filePath: string, patterns: string[]): boolean {
  const normalized = normalizePath(filePath);
  return patterns.some((pattern) => matchesProtectedPattern(normalized, pattern));
}

function matchesProtectedPattern(filePath: string, pattern: string): boolean {
  const cleanPattern = normalizePath(pattern);

  if (cleanPattern === filePath) return true;

  if (cleanPattern.endsWith("/**")) {
    const prefix = cleanPattern.slice(0, -3);
    return filePath === prefix.replace(/\/$/, "") || filePath.startsWith(prefix);
  }

  if (cleanPattern.endsWith("/**/*")) {
    const prefix = cleanPattern.slice(0, -5);
    return filePath.startsWith(prefix);
  }

  if (cleanPattern.includes("*")) {
    const regex = new RegExp(
      "^" +
        cleanPattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*") +
        "$"
    );
    if (regex.test(filePath)) return true;

    // Also allow `.env*` to match inside subdirectories.
    if (!cleanPattern.includes("/")) {
      const segments = filePath.split("/");
      return segments.some((segment) => regex.test(segment));
    }
  }

  return false;
}

/**
 * Light-weight anchor check: read the claimed source path and verify the
 * declared line span contains at least one substantive token from the
 * requirement. This guards against the model hallucinating line numbers.
 *
 * Returns true when validation cannot run (file missing) — the runner already
 * dropped cases where the file isn't in spec_paths; for files that exist but
 * are unreadable for some reason we err on the side of keeping the finding.
 */
function sourceLineAnchorsRequirement(args: {
  repoPath: string;
  sourcePath: string;
  sourceLine: number;
  sourceEndLine: number | null;
  requirementText: string;
}): boolean {
  const filePath = path.join(args.repoPath, args.sourcePath);
  let lines: string[];
  try {
    lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  } catch {
    return true;
  }

  const startIdx = args.sourceLine - 1;
  const endIdx = args.sourceEndLine
    ? Math.min(args.sourceEndLine - 1, lines.length - 1)
    : startIdx;
  if (startIdx < 0 || startIdx >= lines.length) return false;

  const window = lines.slice(startIdx, endIdx + 1).join(" ").toLowerCase();
  const tokens = extractAnchorTokens(args.requirementText);
  if (tokens.length === 0) return true;

  return tokens.some((token) => window.includes(token));
}

function extractAnchorTokens(text: string): string[] {
  const lower = text.toLowerCase();
  const candidates = lower
    .split(/[^a-z0-9_]+/g)
    .filter((tok) => tok.length >= 5);
  // Drop very common verbs/connectors that don't help anchoring.
  const stop = new Set([
    "should",
    "shall",
    "would",
    "could",
    "where",
    "which",
    "their",
    "these",
    "those",
    "when",
  ]);
  return candidates.filter((tok) => !stop.has(tok)).slice(0, 5);
}
