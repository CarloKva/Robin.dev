import { log } from "../utils/logger";

const GITHUB_API = "https://api.github.com";

export type OpenIssue = {
  number: number;
  title: string;
  body: string | null;
  url: string;
};

/**
 * List open issues (max 100) for a repo. Returns null when the installation
 * lacks the `issues:read` permission so callers can skip dedup gracefully
 * rather than fail the whole run.
 */
export async function listOpenIssues(args: {
  token: string;
  fullName: string;
}): Promise<OpenIssue[] | null> {
  const url = `${GITHUB_API}/repos/${args.fullName}/issues?state=open&per_page=100`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${args.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (res.status === 403 || res.status === 404) {
    // 403 → missing scope. 404 → token doesn't see the repo (private + no
    // permission). Either way we can't do GitHub dedup; spec says: skip it.
    log.warn(
      { fullName: args.fullName, status: res.status },
      "github-issues: skipping issue dedup (no permission)"
    );
    return null;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    log.warn(
      { fullName: args.fullName, status: res.status, body: body.slice(0, 200) },
      "github-issues: list failed"
    );
    return null;
  }

  const data = (await res.json()) as Array<{
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    pull_request?: unknown;
  }>;

  // GitHub returns PRs in the issues list — filter them out by the marker.
  return data
    .filter((row) => !row.pull_request)
    .map((row) => ({
      number: row.number,
      title: row.title,
      body: row.body,
      url: row.html_url,
    }));
}

const COSINE_THRESHOLD = 0.82;

/**
 * Normalize a free-form title: lowercase, strip punctuation, collapse
 * whitespace, remove leading priority/severity tags like "[P1]", "p0:".
 */
export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\s*\[?p[0-3]\]?\s*[:.\-—]?\s*/g, "")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "to", "of", "and", "or",
  "in", "on", "at", "for", "by", "with", "from", "as", "it", "this", "that",
  "these", "those", "we", "you", "they", "i", "me", "us",
]);

/**
 * Apply a minimal suffix stem so cosmetic variants collapse: "crashes" and
 * "crash", "breaking" and "break", "tests" and "test". This is not a real
 * stemmer (Porter would be overkill here) — just enough to keep the cosine
 * similarity above the documented 0.82 threshold for obvious dup titles.
 */
function stem(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokenize(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter((tok) => tok.length >= 2 && !STOPWORDS.has(tok))
    .map(stem);
}

/**
 * Term-frequency cosine similarity between two titles, after tokenization +
 * stopword removal. Returns 0 when either side has no tokens.
 */
export function titleCosineSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const tok of ta) freqA.set(tok, (freqA.get(tok) ?? 0) + 1);
  for (const tok of tb) freqB.set(tok, (freqB.get(tok) ?? 0) + 1);

  const vocab = new Set([...freqA.keys(), ...freqB.keys()]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const tok of vocab) {
    const va = freqA.get(tok) ?? 0;
    const vb = freqB.get(tok) ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type IssueMatch = {
  issue: OpenIssue;
  reason: "exact_title" | "cosine_title" | "sentry_source_ref";
};

/**
 * Find an open GitHub issue that already tracks the given finding.
 *
 * Match order (most specific first):
 *   1. exact normalized title;
 *   2. Sentry source_ref present in issue title or body;
 *   3. token cosine similarity ≥ 0.82.
 */
export function findMatchingIssue(args: {
  finding: { title: string; source_ref: string | null };
  issues: OpenIssue[];
}): IssueMatch | null {
  const normalizedFindingTitle = normalizeTitle(args.finding.title);

  for (const issue of args.issues) {
    if (normalizeTitle(issue.title) === normalizedFindingTitle) {
      return { issue, reason: "exact_title" };
    }
  }

  if (args.finding.source_ref) {
    const needle = args.finding.source_ref.toLowerCase();
    for (const issue of args.issues) {
      const haystack = `${issue.title.toLowerCase()}\n${(issue.body ?? "").toLowerCase()}`;
      if (haystack.includes(needle)) {
        return { issue, reason: "sentry_source_ref" };
      }
    }
  }

  for (const issue of args.issues) {
    if (titleCosineSimilarity(args.finding.title, issue.title) >= COSINE_THRESHOLD) {
      return { issue, reason: "cosine_title" };
    }
  }

  return null;
}

export { COSINE_THRESHOLD };
