import { GitCommit } from "lucide-react";
import type { TimelineEntry } from "@robin/shared-types";
import type { EventPayloadMap } from "@robin/shared-types";

interface CommitListProps {
  events: TimelineEntry[];
  /** Base GitHub URL for the repo — used to build commit links. e.g. "https://github.com/org/repo" */
  repoUrl?: string;
}

/**
 * List of commits produced by the agent for a task.
 * Extracts `agent.commit.pushed` events from the timeline.
 * Highlights Conventional Commit prefixes (fix:, feat:, test:, etc.).
 */
export function CommitList({ events, repoUrl }: CommitListProps) {
  const commits = events
    .filter((e) => e.event_type === "agent.commit.pushed")
    .map((e) => ({
      id: e.id,
      created_at: e.created_at,
      ...(e.payload as EventPayloadMap["agent.commit.pushed"]),
    }));

  if (commits.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Commit ({commits.length})
      </h3>
      <div className="space-y-0 rounded-lg border border-border bg-card overflow-hidden">
        {commits.map((commit) => {
          const sha = commit.commit_sha.slice(0, 7);
          const { prefix, rest } = parseConventionalCommit(commit.message ?? "");
          const commitUrl =
            repoUrl ? `${repoUrl}/commit/${commit.commit_sha}` : null;

          return (
            <div
              key={commit.id}
              className="flex items-start gap-2 border-b border-border px-3 py-2.5 last:border-0"
            >
              <GitCommit className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {prefix && (
                    <span className="rounded bg-brand-100 px-1 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                      {prefix}
                    </span>
                  )}
                  <span className="text-sm text-foreground">{rest || commit.message}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                  {commitUrl ? (
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {sha}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">{sha}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{commit.branch}</span>
                  {(commit.additions !== undefined || commit.deletions !== undefined) && (
                    <span className="text-xs">
                      {commit.additions !== undefined && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{commit.additions}
                        </span>
                      )}
                      {commit.additions !== undefined && commit.deletions !== undefined && (
                        <span className="text-muted-foreground"> / </span>
                      )}
                      {commit.deletions !== undefined && (
                        <span className="text-red-500 dark:text-red-400">
                          −{commit.deletions}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CONVENTIONAL_PREFIXES =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?(!)?:\s*/;

function parseConventionalCommit(message: string): {
  prefix: string;
  rest: string;
} {
  const match = message.match(CONVENTIONAL_PREFIXES);
  if (!match) return { prefix: "", rest: message };
  return {
    prefix: match[0].replace(/:\s*$/, ":").trim(),
    rest: message.slice(match[0].length),
  };
}
