import { createHash } from "crypto";

/**
 * Normalize a requirement string for dedup. The goal is that the same
 * requirement re-emitted with cosmetic whitespace or quote differences
 * produces an identical hash.
 */
export function normalizeRequirement(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export type SpecFindingDedupKey = {
  repositoryId: string;
  sourcePath: string;
  sourceLine: number | null | undefined;
  requirementText: string;
  status: string;
};

export function computeSpecFindingDedupHash(key: SpecFindingDedupKey): string {
  const parts = [
    key.repositoryId,
    key.sourcePath,
    key.sourceLine ?? "",
    normalizeRequirement(key.requirementText),
    key.status,
  ];
  return createHash("sha256").update(parts.join("|"), "utf-8").digest("hex");
}

export type BugFindingDedupKey = {
  repositoryId: string;
  title: string;
  source: string;
  sourceRef: string | null | undefined;
  severity: string;
};

/**
 * Bug findings dedupe on: repo + normalized title + source + source_ref +
 * severity. Two crash reports for the same Sentry fingerprint always collapse
 * because `source_ref` is identical; an arbitrary new static-analysis finding
 * collapses if its title normalizes to the same string at the same severity.
 */
export function computeBugFindingDedupHash(key: BugFindingDedupKey): string {
  const parts = [
    key.repositoryId,
    normalizeRequirement(key.title),
    key.source,
    key.sourceRef ?? "",
    key.severity,
  ];
  return createHash("sha256").update(parts.join("|"), "utf-8").digest("hex");
}
