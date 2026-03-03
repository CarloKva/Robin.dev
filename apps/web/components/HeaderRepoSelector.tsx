"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RepoSelector } from "./RepoSelector";
import type { Repository } from "@robin/shared-types";

interface HeaderRepoSelectorProps {
  repositories: Repository[];
  workspaceId: string;
}

export function HeaderRepoSelector({ repositories, workspaceId }: HeaderRepoSelectorProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);

  const storageKey = `robin:activeRepoId:${workspaceId}`;

  // Load persisted repo from localStorage on mount
  useEffect(() => {
    if (repositories.length === 0) return;
    const stored = localStorage.getItem(storageKey);
    if (stored && repositories.some((r) => r.id === stored)) {
      setActiveRepoId(stored);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply repo filter when navigating to /backlog
  useEffect(() => {
    if (!activeRepoId) return;
    if (pathname.startsWith("/backlog")) {
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has("repositoryId")) {
        params.set("repositoryId", activeRepoId);
        params.delete("page");
        router.replace(`/backlog?${params.toString()}`);
      }
    }
  }, [pathname, activeRepoId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRepoSelect(id: string | null) {
    setActiveRepoId(id);
    if (id) {
      localStorage.setItem(storageKey, id);
    } else {
      localStorage.removeItem(storageKey);
    }
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

  if (repositories.length === 0) return null;

  return (
    <div className="w-44">
      <RepoSelector
        repositories={repositories}
        activeRepoId={activeRepoId}
        onSelect={handleRepoSelect}
        align="right"
      />
    </div>
  );
}
