import { GitPullRequest, ExternalLink, GitMerge, GitPullRequestClosed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PRData } from "@robin/shared-types";

type PRStatus = "open" | "merged" | "closed" | "draft";

const statusConfig: Record<
  PRStatus,
  { label: string; icon: React.ElementType; dotClass: string; badgeClass: string }
> = {
  open: {
    label: "Open",
    icon: GitPullRequest,
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  merged: {
    label: "Merged",
    icon: GitMerge,
    dotClass: "bg-brand-500",
    badgeClass: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
  },
  closed: {
    label: "Closed",
    icon: GitPullRequestClosed,
    dotClass: "bg-neutral-400",
    badgeClass: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  },
  draft: {
    label: "Draft",
    icon: GitPullRequest,
    dotClass: "bg-neutral-300",
    badgeClass: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500",
  },
};

interface PRCardProps {
  data: PRData;
  /** Shown when PR is open and no human.approved event yet */
  needsReview?: boolean;
}

/**
 * Pull request card shown in the task detail artifacts section.
 * Displays PR title, number, status, diff stats, and link to GitHub.
 */
export function PRCard({ data, needsReview = false }: PRCardProps) {
  const status = data.status;
  const conf = statusConfig[status];
  const Icon = conf.icon;

  const urlLabel = data.pr_number ? `PR #${data.pr_number}` : "Pull Request";
  const title = data.title ?? urlLabel;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{title}</span>
            {needsReview && status === "open" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Review richiesta
              </span>
            )}
          </div>
          {data.branch && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
              {data.branch}
            </p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
            conf.badgeClass
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", conf.dotClass)} />
          {conf.label}
        </span>
      </div>

      {/* Diff stats */}
      {(data.additions !== undefined ||
        data.deletions !== undefined ||
        data.changed_files !== undefined ||
        data.commits !== undefined) && (
        <div className="flex flex-wrap gap-3 border-t border-border bg-muted/30 px-4 py-2">
          {data.commits !== undefined && (
            <DiffStat label="commit" value={data.commits} />
          )}
          {data.changed_files !== undefined && (
            <DiffStat label="file modificati" value={data.changed_files} />
          )}
          {data.additions !== undefined && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              +{data.additions}
            </span>
          )}
          {data.deletions !== undefined && (
            <span className="text-xs font-medium text-red-500 dark:text-red-400">
              −{data.deletions}
            </span>
          )}
        </div>
      )}

      {/* Footer link */}
      <div className="border-t border-border px-4 py-2.5">
        <a
          href={data.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Apri su GitHub
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function DiffStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span> {label}
    </span>
  );
}
