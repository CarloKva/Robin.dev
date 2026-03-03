"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import type { Repository } from "@robin/shared-types";

interface RepoSelectorProps {
  repositories: Repository[];
  activeRepoId: string | null;
  onSelect: (id: string | null) => void;
}

export function RepoSelector({ repositories, activeRepoId, onSelect }: RepoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeRepo = repositories.find((r) => r.id === activeRepoId);
  const showSearch = repositories.length > 5;
  const filteredRepos = showSearch && search
    ? repositories.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()))
    : repositories;

  function handleSelect(id: string | null) {
    onSelect(id);
    setIsOpen(false);
    setSearch("");
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
        aria-label="Seleziona repository"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          <span className="truncate text-xs font-medium leading-none">
            {activeRepo
              ? (activeRepo.full_name.split("/")[1] ?? activeRepo.full_name)
              : "Tutte le repo"}
          </span>
        </div>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-lg">
          {showSearch && (
            <div className="border-b border-border p-1.5">
              <div className="flex items-center gap-1.5 rounded border border-border px-2 py-1">
                <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca repo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="max-h-52 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 transition-colors hover:bg-accent"
            >
              <span className="text-xs text-muted-foreground">Tutte le repo</span>
              {activeRepoId === null && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>

            {filteredRepos.length === 0 ? (
              <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                Nessuna repo trovata.
              </p>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => handleSelect(repo.id)}
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 text-left">
                    <p className="truncate text-xs font-medium">
                      {repo.full_name.split("/")[1] ?? repo.full_name}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">{repo.full_name}</p>
                  </div>
                  {repo.id === activeRepoId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
