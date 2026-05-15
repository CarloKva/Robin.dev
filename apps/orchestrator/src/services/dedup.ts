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
