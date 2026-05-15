import { isProtectedPath } from "./spec-discovery.validator";

export type RawBugFinding = {
  title?: unknown;
  description?: unknown;
  severity?: unknown;
  hypothesis?: unknown;
  repro_steps?: unknown;
  evidence?: unknown;
  affected_paths?: unknown;
  suggested_fix_outline?: unknown;
  confidence?: unknown;
  source?: unknown;
  source_ref?: unknown;
  external_issue_url?: unknown;
};

export type ValidatedBugFinding = {
  title: string;
  description: string;
  severity: "P0" | "P1" | "P2" | "P3";
  hypothesis: string;
  repro_steps: string | null;
  evidence: Record<string, unknown>;
  affected_paths: string[];
  suggested_fix_outline: string | null;
  confidence: number;
  source: "sentry" | "static_analysis" | "commit_correlation";
  source_ref: string | null;
  external_issue_url: string | null;
};

export type BugDiscoveryRawOutput = {
  findings?: unknown;
  summary?: unknown;
  tokens_used?: unknown;
  cost_usd?: unknown;
};

export type BugDiscoveryValidatedOutput = {
  findings: ValidatedBugFinding[];
  summary: string;
  tokens_used: number;
  cost_usd: number;
};

export type BugValidatorOptions = {
  protectedPaths: string[];
  staticOnlyConfidenceFloor?: number;
  maxFindings?: number;
};

export type BugValidationResult = {
  output: BugDiscoveryValidatedOutput;
  dropped: Array<{ reason: string; finding: RawBugFinding }>;
};

const VALID_SEVERITIES = new Set(["P0", "P1", "P2", "P3"]);
const VALID_SOURCES = new Set(["sentry", "static_analysis", "commit_correlation"]);
const RUNTIME_SOURCES = new Set(["sentry", "commit_correlation"]);
const DEFAULT_STATIC_CONFIDENCE_FLOOR = 0.75;
const DEFAULT_MAX_FINDINGS = 30;

/**
 * Validate bug_discovery JSON against the runner-side rules from the spec:
 *
 *   - shape (title, description, severity, hypothesis, evidence,
 *     affected_paths, confidence, source);
 *   - severity P0/P1 require evidence.stack_trace OR evidence.sentry_issue_id;
 *   - static_analysis findings cap at P2 severity and 0.75 confidence floor;
 *   - affected_paths must not intersect protected_paths;
 *   - max 30 findings (keeps highest severity / confidence first).
 *
 * Top-level shape errors throw (the model failed the contract). Per-finding
 * rule violations drop the finding silently and surface the reason for
 * observability.
 */
export function validateBugDiscoveryOutput(
  raw: BugDiscoveryRawOutput,
  opts: BugValidatorOptions
): BugValidationResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("bug-discovery validator: output is not an object");
  }
  if (!Array.isArray(raw.findings)) {
    throw new Error("bug-discovery validator: `findings` must be an array");
  }
  if (typeof raw.summary !== "string") {
    throw new Error("bug-discovery validator: `summary` must be a string");
  }

  const tokensUsed = toNonNegativeInt(raw.tokens_used);
  if (tokensUsed === null) {
    throw new Error("bug-discovery validator: `tokens_used` must be a non-negative integer");
  }

  const costUsd = toNonNegativeNumber(raw.cost_usd);
  if (costUsd === null) {
    throw new Error("bug-discovery validator: `cost_usd` must be a non-negative number");
  }

  const protectedPaths = opts.protectedPaths.map((p) => p.trim()).filter(Boolean);
  const staticFloor = opts.staticOnlyConfidenceFloor ?? DEFAULT_STATIC_CONFIDENCE_FLOOR;
  const maxFindings = opts.maxFindings ?? DEFAULT_MAX_FINDINGS;

  const validated: ValidatedBugFinding[] = [];
  const dropped: Array<{ reason: string; finding: RawBugFinding }> = [];

  for (const rawFinding of raw.findings as RawBugFinding[]) {
    const verdict = validateFinding(rawFinding, {
      protectedPaths,
      staticFloor,
    });
    if (verdict.kind === "drop") {
      dropped.push({ reason: verdict.reason, finding: rawFinding });
      continue;
    }
    validated.push(verdict.finding);
  }

  // Cap to maxFindings preferring P0 > P1 > P2 > P3 then confidence.
  const sevOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  validated.sort((a, b) => {
    const sevDiff = sevOrder[a.severity]! - sevOrder[b.severity]!;
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });
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

type FindingVerdict =
  | { kind: "keep"; finding: ValidatedBugFinding }
  | { kind: "drop"; reason: string };

function validateFinding(
  raw: RawBugFinding,
  ctx: { protectedPaths: string[]; staticFloor: number }
): FindingVerdict {
  if (!raw || typeof raw !== "object") {
    return { kind: "drop", reason: "finding_not_object" };
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return { kind: "drop", reason: "missing_title" };

  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (!description) return { kind: "drop", reason: "missing_description" };

  const severity = typeof raw.severity === "string" ? raw.severity : "";
  if (!VALID_SEVERITIES.has(severity)) {
    return { kind: "drop", reason: "invalid_severity" };
  }

  const source = typeof raw.source === "string" ? raw.source : "";
  if (!VALID_SOURCES.has(source)) {
    return { kind: "drop", reason: "invalid_source" };
  }

  const confidence = typeof raw.confidence === "number" ? raw.confidence : NaN;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { kind: "drop", reason: "invalid_confidence" };
  }

  if (source === "static_analysis" && confidence < ctx.staticFloor) {
    return { kind: "drop", reason: "static_confidence_below_floor" };
  }

  // P0/P1 require runtime evidence (stack_trace OR sentry_issue_id).
  const evidence = raw.evidence && typeof raw.evidence === "object" ? raw.evidence : {};
  const evidenceObj = evidence as Record<string, unknown>;
  const hasRuntimeEvidence =
    typeof evidenceObj["stack_trace"] === "string" ||
    typeof evidenceObj["sentry_issue_id"] === "string";

  if ((severity === "P0" || severity === "P1") && !hasRuntimeEvidence) {
    return { kind: "drop", reason: "high_severity_without_runtime_evidence" };
  }

  // Static-only findings cap at P2.
  if (source === "static_analysis" && (severity === "P0" || severity === "P1")) {
    return { kind: "drop", reason: "static_findings_capped_at_p2" };
  }

  const hypothesis = typeof raw.hypothesis === "string" ? raw.hypothesis.trim() : "";
  if (!hypothesis) return { kind: "drop", reason: "missing_hypothesis" };

  const reproSteps =
    typeof raw.repro_steps === "string" && raw.repro_steps.trim().length > 0
      ? raw.repro_steps.trim()
      : null;

  const affectedRaw = Array.isArray(raw.affected_paths) ? raw.affected_paths : [];
  if (affectedRaw.length === 0) {
    return { kind: "drop", reason: "missing_affected_paths" };
  }

  const affected: string[] = [];
  for (const value of affectedRaw) {
    if (typeof value !== "string") continue;
    const normalized = value.replace(/^\.\//, "").replace(/^\/+/, "").replace(/\\/g, "/").trim();
    if (!normalized) continue;
    if (isProtectedPath(normalized, ctx.protectedPaths)) {
      return { kind: "drop", reason: "affected_path_protected" };
    }
    affected.push(normalized);
  }
  if (affected.length === 0) {
    return { kind: "drop", reason: "missing_affected_paths" };
  }

  const suggestedFix =
    typeof raw.suggested_fix_outline === "string" && raw.suggested_fix_outline.trim().length > 0
      ? raw.suggested_fix_outline.trim()
      : null;

  const sourceRef =
    typeof raw.source_ref === "string" && raw.source_ref.trim().length > 0
      ? raw.source_ref.trim()
      : null;

  const externalIssueUrl =
    typeof raw.external_issue_url === "string" && raw.external_issue_url.trim().length > 0
      ? raw.external_issue_url.trim()
      : null;

  return {
    kind: "keep",
    finding: {
      title,
      description,
      severity: severity as ValidatedBugFinding["severity"],
      hypothesis,
      repro_steps: reproSteps,
      evidence: evidenceObj,
      affected_paths: affected,
      suggested_fix_outline: suggestedFix,
      confidence,
      source: source as ValidatedBugFinding["source"],
      source_ref: sourceRef,
      external_issue_url: externalIssueUrl,
    },
  };
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

export { RUNTIME_SOURCES };
