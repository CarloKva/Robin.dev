import * as fs from "fs";
import * as path from "path";
import { isProtectedPath } from "./spec-discovery.validator";

// ─── Phase 1: planning pass ─────────────────────────────────────────────────

export type SpecImplPlan = {
  phase: "plan";
  file_allowlist: string[];
  test_strategy: string;
  summary_per_file: Array<{ path: string; change: string }>;
  needs_dependency_change: boolean;
  needs_decomposition?: boolean;
  decomposition_reason?: string;
  tokens_used: number;
  cost_usd: number;
};

export type PlanValidatorOptions = {
  protectedPaths: string[];
  maxAllowlistSize?: number;
};

export function validateSpecImplPlan(
  raw: unknown,
  opts: PlanValidatorOptions
): SpecImplPlan {
  if (!raw || typeof raw !== "object") {
    throw new Error("spec-impl plan validator: output is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj["phase"] !== "plan") {
    throw new Error("spec-impl plan validator: phase must be 'plan'");
  }
  if (!Array.isArray(obj["file_allowlist"])) {
    throw new Error("spec-impl plan validator: `file_allowlist` must be an array");
  }
  if (typeof obj["test_strategy"] !== "string") {
    throw new Error("spec-impl plan validator: `test_strategy` must be a string");
  }
  if (!Array.isArray(obj["summary_per_file"])) {
    throw new Error("spec-impl plan validator: `summary_per_file` must be an array");
  }

  const tokens = toNonNegativeInt(obj["tokens_used"]);
  if (tokens === null) {
    throw new Error("spec-impl plan validator: invalid tokens_used");
  }
  const cost = toNonNegativeNumber(obj["cost_usd"]);
  if (cost === null) {
    throw new Error("spec-impl plan validator: invalid cost_usd");
  }

  const allowlist: string[] = [];
  for (const value of obj["file_allowlist"] as unknown[]) {
    if (typeof value !== "string") continue;
    const normalized = normalize(value.trim());
    if (!normalized) continue;
    if (isProtectedPath(normalized, opts.protectedPaths)) {
      throw new Error(`spec-impl plan: allowlist includes protected path ${normalized}`);
    }
    allowlist.push(normalized);
  }

  const cap = opts.maxAllowlistSize ?? 30;
  if (allowlist.length === 0) {
    throw new Error("spec-impl plan: file_allowlist is empty");
  }
  if (allowlist.length > cap) {
    throw new Error(`spec-impl plan: file_allowlist exceeds ${cap} entries`);
  }

  const summary: Array<{ path: string; change: string }> = [];
  for (const entry of obj["summary_per_file"] as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const filePath = typeof row["path"] === "string" ? normalize(row["path"].trim()) : "";
    const change = typeof row["change"] === "string" ? row["change"].trim() : "";
    if (!filePath || !change) continue;
    if (!allowlist.includes(filePath)) continue;
    summary.push({ path: filePath, change });
  }

  return {
    phase: "plan",
    file_allowlist: allowlist,
    test_strategy: obj["test_strategy"] as string,
    summary_per_file: summary,
    needs_dependency_change: obj["needs_dependency_change"] === true,
    ...(obj["needs_decomposition"] === true ? { needs_decomposition: true } : {}),
    ...(typeof obj["decomposition_reason"] === "string"
      ? { decomposition_reason: obj["decomposition_reason"] as string }
      : {}),
    tokens_used: tokens,
    cost_usd: cost,
  };
}

// ─── Phase 2: implementation pass ───────────────────────────────────────────

export type SpecImplResult = {
  phase: "impl";
  pr_url: string | null;
  branch: string;
  files_changed: string[];
  tests_added: string[];
  tests_run: string[];
  outcome: "success" | "abandoned";
  reason?: string;
  tokens_used: number;
  cost_usd: number;
};

export type ImplValidatorOptions = {
  protectedPaths: string[];
  allowlist: string[];
  expectedBranch: string;
  /** Hard cap on total lines added in the PR diff. */
  maxAddedLines?: number;
};

export type ImplValidationResult = {
  result: SpecImplResult;
  warnings: string[];
};

export function validateSpecImplResult(
  raw: unknown,
  opts: ImplValidatorOptions
): ImplValidationResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("spec-impl result validator: output is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj["phase"] !== "impl") {
    throw new Error("spec-impl result validator: phase must be 'impl'");
  }

  const tokens = toNonNegativeInt(obj["tokens_used"]);
  if (tokens === null) throw new Error("spec-impl result validator: invalid tokens_used");
  const cost = toNonNegativeNumber(obj["cost_usd"]);
  if (cost === null) throw new Error("spec-impl result validator: invalid cost_usd");

  // Abandoned exit — surface the reason for triage.
  if (obj["outcome"] === "abandoned") {
    return {
      result: {
        phase: "impl",
        pr_url: null,
        branch: opts.expectedBranch,
        files_changed: [],
        tests_added: [],
        tests_run: [],
        outcome: "abandoned",
        reason:
          typeof obj["reason"] === "string" ? (obj["reason"] as string) : "abandoned",
        tokens_used: tokens,
        cost_usd: cost,
      },
      warnings: [],
    };
  }

  if (typeof obj["branch"] !== "string") {
    throw new Error("spec-impl result validator: `branch` must be a string");
  }
  if (obj["branch"] !== opts.expectedBranch) {
    throw new Error(
      `spec-impl result validator: branch ${String(obj["branch"])} does not match expected ${opts.expectedBranch}`
    );
  }
  const prUrl =
    typeof obj["pr_url"] === "string" && /^https:\/\/github\.com\//.test(obj["pr_url"])
      ? (obj["pr_url"] as string)
      : null;
  if (!prUrl) {
    throw new Error("spec-impl result validator: `pr_url` must be a github.com URL");
  }

  const filesChanged = toStringArray(obj["files_changed"]);
  const testsAdded = toStringArray(obj["tests_added"]);
  const testsRun = toStringArray(obj["tests_run"]);

  const warnings: string[] = [];
  const allowlistSet = new Set(opts.allowlist);
  for (const file of filesChanged) {
    if (isProtectedPath(file, opts.protectedPaths)) {
      throw new Error(`spec-impl result: file ${file} is in protected_paths`);
    }
    if (!allowlistSet.has(file)) {
      throw new Error(`spec-impl result: file ${file} is not in the approved plan allowlist`);
    }
  }

  if (filesChanged.length === 0) {
    throw new Error("spec-impl result: no files changed despite outcome=success");
  }
  if (testsAdded.length === 0 && !filesChanged.some((f) => /__tests__|\.test\.|\.spec\./.test(f))) {
    warnings.push("no_tests_added");
  }
  if (testsRun.length === 0) {
    warnings.push("no_tests_run");
  }

  return {
    result: {
      phase: "impl",
      pr_url: prUrl,
      branch: opts.expectedBranch,
      files_changed: filesChanged,
      tests_added: testsAdded,
      tests_run: testsRun,
      outcome: "success",
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
