"use client";

import { useState } from "react";
import { BacklogClient } from "./BacklogClient";
import { SprintTabView } from "./SprintTabView";
import type { Task, Repository, Sprint, SprintWithTasks } from "@robin/shared-types";

interface BacklogSprintTabsProps {
  // Backlog tab data
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  repositories: Repository[];
  sprints: Sprint[];
  // Sprint tab data
  activeSprint: SprintWithTasks | null;
  planningSprint: SprintWithTasks | null;
  pastSprints: Sprint[];
  workspaceId: string;
  // Initial active tab
  defaultTab: "backlog" | "sprint";
}

export function BacklogSprintTabs({
  tasks,
  total,
  page,
  pageSize,
  repositories,
  sprints,
  activeSprint,
  planningSprint,
  pastSprints,
  workspaceId,
  defaultTab,
}: BacklogSprintTabsProps) {
  const [activeTab, setActiveTab] = useState<"backlog" | "sprint">(defaultTab);

  return (
    <div className="space-y-6">
      {/* Tab switcher — minimal, fluid */}
      <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("backlog")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
            activeTab === "backlog"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground/80"
          }`}
        >
          Backlog
          {total > 0 && (
            <span className="ml-1.5 rounded-full bg-muted/80 px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
              {total}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sprint")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
            activeTab === "sprint"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground/80"
          }`}
        >
          Sprint
          {(activeSprint ?? planningSprint) && (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                activeSprint
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                  : "bg-sky-100 text-sky-600 dark:bg-sky-900/30"
              }`}
            >
              {activeSprint ? "Attivo" : "Pianificazione"}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "backlog" ? (
        <BacklogClient
          tasks={tasks}
          total={total}
          page={page}
          pageSize={pageSize}
          repositories={repositories}
          sprints={sprints}
        />
      ) : (
        <SprintTabView
          activeSprint={activeSprint}
          planningSprint={planningSprint}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
