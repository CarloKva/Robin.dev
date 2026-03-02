"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { RepoSelector } from "./RepoSelector";
import type { Repository } from "@robin/shared-types";

interface SidebarProps {
  repositories?: Repository[];
  workspaceId?: string;
}

const NAV_ITEMS = [
  { href: "/backlog", label: "Backlog" },
  { href: "/agents", label: "Agents" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({ repositories = [], workspaceId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);

  const storageKey = workspaceId ? `robin:activeRepoId:${workspaceId}` : null;

  // Load persisted repo from localStorage on mount
  useEffect(() => {
    if (!storageKey || repositories.length === 0) return;
    const stored = localStorage.getItem(storageKey);
    if (stored && repositories.some((r) => r.id === stored)) {
      setActiveRepoId(stored);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  function handleRepoSelect(id: string | null) {
    setActiveRepoId(id);

    // Persist to localStorage
    if (storageKey) {
      if (id) {
        localStorage.setItem(storageKey, id);
      } else {
        localStorage.removeItem(storageKey);
      }
    }

    // Update URL params on pages that support repo filtering
    if (pathname.startsWith("/backlog")) {
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set("repositoryId", id);
      } else {
        params.delete("repositoryId");
      }
      params.delete("page");
      router.push(`/backlog?${params.toString()}`);
    }
  }

  // Backlog link includes active repo filter when one is selected
  const backlogHref = activeRepoId
    ? `/backlog?repositoryId=${activeRepoId}`
    : "/backlog";

  return (
    <aside className="hidden w-56 flex-col border-r border-border bg-background md:flex">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-lg font-bold tracking-tight">Robin.dev</span>
      </div>

      {/* Repository selector */}
      {repositories.length > 0 && workspaceId && (
        <div className="border-b border-border px-3 py-2">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Repository
          </p>
          <RepoSelector
            repositories={repositories}
            activeRepoId={activeRepoId}
            onSelect={handleRepoSelect}
          />
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          // Use backlogHref for the backlog item
          const href = item.href === "/backlog" ? backlogHref : item.href;
          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            // Mark Backlog active when on sprint detail pages
            (item.href === "/backlog" && pathname.startsWith("/sprints"));
          const isLoading = loadingHref === item.href;
          return (
            <Link
              key={item.href}
              href={href}
              onClick={() => {
                if (!isActive) setLoadingHref(item.href);
              }}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <span>{item.label}</span>
              {isLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <p className="px-3 text-xs text-muted-foreground">
          <kbd className="rounded border border-border px-1 font-mono">N</kbd> Nuova task
        </p>
      </div>
    </aside>
  );
}
