import { isProtectedPath } from "./spec-discovery.validator";

// ─── Phase 1: reproduction pass ─────────────────────────────────────────────

export type BugImplRepro = {
  phase: "repro";
  outcome: "reproduced" | "cannot_reproduce";
  regression_test_path: string | null;
  failure_output: string | null;
  tokens_used: number;
  cost_usd: number;
};

export type ReproValidatorOptions = {
  protectedPaths: string[];
};

export function validateBugImplRepro(
  raw: unknown,
  opts: ReproValidatorOptions
): BugImplRepro {
  if (!raw || typeof raw !== "object") {
    throw new Error("bug-impl repro validator: output is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj["phase"] !== "repro") {
    throw new Error("bug-impl repro validator: phase must be 'repro'");
  }

  const tokens = toNonNegativeInt(obj["tokens_used"]);
  if (tokens === null) throw new Error("bug-impl repro validator: invalid tokens_used");
  const cost = toNonNegativeNumber(obj["cost_usd"]);
  if (cost === null) throw new Error("bug-impl repro validator: invalid cost_usd");

  const outcome = obj["outcome"];
  if (outcome !== "reproduced" && outcome !== "cannot_reproduce") {
    throw new Error("bug-impl repro validator: invalid outcome");
  }

  let regressionPath: string | null = null;
  if (outcome === "reproduced") {
    const raw = obj["regression_test_path"];
    if (typeof raw !== "string" || raw.trim().length === 0) {
      throw new Error("bug-impl repro: regression_test_path required when reproduced");
    }
    regressionPath = normalize(raw.trim());
    if (isProtectedPath(regressionPath, opts.protectedPaths)) {
      throw new Error("bug-impl repro: regression test path is protected");
    }
    if (!/__tests__|\.test\.|\.spec\./.test(regressionPath)) {
      throw new Error("bug-impl repro: regression test path must look like a test file");
    }
  } else if (typeof obj["regression_test_path"] === "string") {
    regressionPath = normalize((obj["regression_test_path"] as string).trim()) || null;
  }

  return {
    phase: "repro",
    outcome,
    regression_test_path: regressionPath,
    failure_output:
      typeof obj["failure_output"] === "string" ? (obj["failure_output"] as string) : null,
    tokens_used: tokens,
    cost_usd: cost,
  };
}

// ─── Phase 2: fix pass ──────────────────────────────────────────────────────

export type BugImplFix = {
  phase: "fix";
  outcome: "success" | "needs_design" | "abandoned";
  pr_url: string | null;
  branch: string;
  regression_test_path: string | null;
  files_changed: string[];
  tests_run: string[];
  reason?: string;
  tokens_used: number;
  cost_usd: number;
};

export type FixValidatorOptions = {
  protectedPaths: string[];
  expectedBranch: string;
  reproRegressionTestPath: string | null;
  /** Hard cap on non-test files modified. Spec says 3. */
  maxNonTestFiles?: number;
};

export type FixValidationResult = {
  result: BugImplFix;
  warnings: string[];
};

const DEFAULT_MAX_NON_TEST_FILES = 3;

export function validateBugImplFix(
  raw: unknown,
  opts: FixValidatorOptions
): FixValidationResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("bug-impl fix validator: output is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj["phase"] !== "fix") {
    throw new Error("bug-impl fix validator: phase must be 'fix'");
  }

  const tokens = toNonNegativeInt(obj["tokens_used"]);
  if (tokens === null) throw new Error("bug-impl fix validator: invalid tokens_used");
  const cost = toNonNegativeNumber(obj["cost_usd"]);
  if (cost === null) throw new Error("bug-impl fix validator: invalid cost_usd");

  const outcome = obj["outcome"];
  if (outcome !== "success" && outcome !== "needs_design" && outcome !== "abandoned") {
    throw new Error("bug-impl fix validator: invalid outcome");
  }

  if (typeof obj["branch"] !== "string" || obj["branch"] !== opts.expectedBranch) {
    throw new Error(
      `bug-impl fix validator: branch ${String(obj["branch"])} does not match expected ${opts.expectedBranch}`
    );
  }

  // Non-success outcomes — surface and stop.
  if (outcome !== "success") {
    return {
      result: {
        phase: "fix",
        outcome,
        pr_url: null,
        branch: opts.expectedBranch,
        regression_test_path: opts.reproRegressionTestPath,
        files_changed: [],
        tests_run: [],
        reason:
          typeof obj["reason"] === "string" ? (obj["reason"] as string) : outcome,
        tokens_used: tokens,
        cost_usd: cost,
      },
      warnings: [],
    };
  }

  // Success path validation.
  const prUrl =
    typeof obj["pr_url"] === "string" && /^https:\/\/github\.com\//.test(obj["pr_url"])
      ? (obj["pr_url"] as string)
      : null;
  if (!prUrl) throw new Error("bug-impl fix validator: pr_url must be a github.com URL");

  const filesChanged = toStringArray(obj["files_changed"]);
  if (filesChanged.length === 0) {
    throw new Error("bug-impl fix validator: no files_changed despite outcome=success");
  }
  for (const file of filesChanged) {
    if (isProtectedPath(file, opts.protectedPaths)) {
      throw new Error(`bug-impl fix: file ${file} is in protected_paths`);
    }
  }

  const isTestFile = (p: string) => /__tests__|\.test\.|\.spec\./.test(p);
  const nonTestFiles = filesChanged.filter((f) => !isTestFile(f));
  const cap = opts.maxNonTestFiles ?? DEFAULT_MAX_NON_TEST_FILES;
  if (nonTestFiles.length > cap) {
    throw new Error(
      `bug-impl fix: ${nonTestFiles.length} non-test files changed exceeds cap of ${cap}`
    );
  }

  const regressionPath = typeof obj["regression_test_path"] === "string"
    ? normalize((obj["regression_test_path"] as string).trim())
    : opts.reproRegressionTestPath;

  const warnings: string[] = [];

  if (!regressionPath) {
    throw new Error("bug-impl fix: regression_test_path required on success");
  }
  if (
    opts.reproRegressionTestPath &&
    regressionPath !== opts.reproRegressionTestPath
  ) {
    warnings.push("regression_test_path_changed_between_phases");
  }
  if (!filesChanged.includes(regressionPath)) {
    warnings.push("regression_test_not_in_files_changed");
  }

  const testsRun = toStringArray(obj["tests_run"]);
  if (testsRun.length === 0) warnings.push("no_tests_run");

  return {
    result: {
      phase: "fix",
      outcome: "success",
      pr_url: prUrl,
      branch: opts.expectedBranch,
      regression_test_path: regressionPath,
      files_changed: filesChanged,
      tests_run: testsRun,
      tokens_used: tokens,
      cost_usd: cost,
    },
    warnings,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string") {
      const normalized = normalize(v.trim());
      if (normalized) out.push(normalized);
    }
  }
  return out;
}

function normalize(value: string): string {
  return value.replace(/^\.\//, "").replace(/^\/+/, "").replace(/\\/g, "/");
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
