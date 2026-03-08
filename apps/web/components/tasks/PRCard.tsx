"use client";

import { useState } from "react";
import { GitPullRequest, ExternalLink, GitBranch, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PRData, TimelineEntry } from "@robin/shared-types";
import type { EventPayloadMap } from "@robin/shared-types";

type PRStatus = "open" | "merged" | "closed" | "draft";

const statusConfig: Record<
  PRStatus,
  { label: string; borderColor: string; iconColor: string; badgeBg: string; badgeText: string }
> = {
  open: {
    label: "Open",
    borderColor: "border-l-[#8B5CF6]",
    iconColor: "text-[#8B5CF6]",
    badgeBg: "bg-[#8B5CF6]/10",
    badgeText: "text-[#8B5CF6]",
  },
  merged: {
    label: "Merged",
    borderColor: "border-l-[#6D28D9]",
    iconColor: "text-[#6D28D9]",
    badgeBg: "bg-[#6D28D9]/10",
    badgeText: "text-[#6D28D9]",
  },
  closed: {
    label: "Closed",
    borderColor: "border-l-[#FF3B30]",
    iconColor: "text-[#FF3B30]",
    badgeBg: "bg-[#FF3B30]/10",
    badgeText: "text-[#FF3B30]",
  },
  draft: {
    label: "Draft",
    borderColor: "border-l-[#8E8E93]",
    iconColor: "text-[#8E8E93]",
    badgeBg: "bg-[#8E8E93]/10",
    badgeText: "text-[#8E8E93]",
  },
};

const MAX_VISIBLE_COMMITS = 5;

interface PRCardProps {
  data: PRData | null | undefined;
  events?: TimelineEntry[];
  repoUrl?: string;
}

/**
 * Pull request card shown in the task detail artifacts section.
 * Displays PR title, number, branch, status, commit list and link to GitHub.
 * Shows an empty state when no PR is associated with the task.
 */
export function PRCard({ data, events = [], repoUrl }: PRCardProps) {
  const [commitsExpanded, setCommitsExpanded] = useState(false);

  const commits = events
    .filter((e) => e.event_type === "agent.commit.pushed")
    .map((e) => ({
      id: e.id,
      created_at: e.created_at,
      ...(e.payload as EventPayloadMap["agent.commit.pushed"]),
    }));

  if (!data) {
    return (
      <div className="rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] border border-[#E5E5EA] dark:border-[#38383A] p-6 flex flex-col items-center justify-center gap-2 text-center">
        <GitPullRequest className="h-8 w-8 text-[#8E8E93]" />
        <p className="text-sm font-medium text-[#1C1C1E] dark:text-white">Nessuna PR aperta</p>
        <p className="text-xs text-[#8E8E93]">
          L&apos;agente aprirà una PR quando inizierà a lavorare
        </p>
      </div>
    );
  }

  const conf = statusConfig[data.status];
  const title = data.title ?? (data.pr_number ? `PR #${data.pr_number}` : "Pull Request");

  const openedAt = data.pr_number
    ? events.find((e) => e.event_type === "agent.pr.opened")?.created_at
    : undefined;

  const visibleCommits = commitsExpanded ? commits : commits.slice(0, MAX_VISIBLE_COMMITS);
  const hiddenCount = commits.length - MAX_VISIBLE_COMMITS;

  return (
    <div
      className={cn(
        "rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E]",
        "border border-[#E5E5EA] dark:border-[#38383A]",
        "border-l-[3px] overflow-hidden",
        conf.borderColor
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <GitPullRequest className={cn("mt-0.5 h-4 w-4 flex-shrink-0", conf.iconColor)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#1C1C1E] dark:text-white truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              conf.badgeBg,
              conf.badgeText
            )}
          >
            {conf.label}
          </span>
          <a
            href={data.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#007AFF] hover:underline"
          >
            Apri su GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* PR meta */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {data.pr_number && (
          <span className="text-xs text-[#8E8E93]">#{data.pr_number}</span>
        )}
        {data.branch && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 py-0.5 text-xs text-[#3C3C43] dark:text-[#EBEBF5]">
            <GitBranch className="h-3 w-3" />
            <span className="truncate max-w-[180px]">{data.branch}</span>
          </span>
        )}
        {openedAt && (
          <span className="text-xs text-[#8E8E93]">
            {new Date(openedAt).toLocaleDateString("it-IT", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Commit list */}
      {commits.length > 0 && (
        <div className="border-t border-[#E5E5EA] dark:border-[#38383A]">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#3C3C43] dark:text-[#EBEBF5]">Commit</span>
              <span className="rounded-full bg-[#F2F2F7] dark:bg-[#2C2C2E] px-1.5 py-0.5 text-xs font-medium text-[#8E8E93]">
                {commits.length}
              </span>
            </div>
          </div>
          <div>
            {visibleCommits.map((commit, index) => {
              const sha = commit.commit_sha.slice(0, 7);
              const commitUrl = repoUrl ? `${repoUrl}/commit/${commit.commit_sha}` : null;
              const isLast = index === visibleCommits.length - 1 && (commitsExpanded || hiddenCount <= 0);

              return (
                <div
                  key={commit.id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2",
                    !isLast && "border-b border-[#E5E5EA] dark:border-[#38383A]"
                  )}
                >
                  {commitUrl ? (
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded px-1.5 py-0.5 text-[#007AFF] hover:underline shrink-0"
                    >
                      {sha}
                    </a>
                  ) : (
                    <span className="font-mono text-xs bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded px-1.5 py-0.5 text-[#3C3C43] dark:text-[#EBEBF5] shrink-0">
                      {sha}
                    </span>
                  )}
                  <span className="text-sm text-[#1C1C1E] dark:text-white truncate flex-1">
                    {commit.message ?? sha}
                  </span>
                  <span className="text-xs text-[#8E8E93] shrink-0">
                    {formatRelativeTime(commit.created_at)}
                  </span>
                </div>
              );
            })}
            {hiddenCount > 0 && (
              <button
                onClick={() => setCommitsExpanded((v) => !v)}
                className="flex w-full items-center justify-center gap-1 border-t border-[#E5E5EA] dark:border-[#38383A] px-4 py-2 text-xs text-[#007AFF] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] transition-colors"
              >
                {commitsExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Mostra meno
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Mostra altri {hiddenCount}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "adesso";
  if (diffMins < 60) return `${diffMins}m fa`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h fa`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}g fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
