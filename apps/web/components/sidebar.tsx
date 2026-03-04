"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const NAV_ITEMS = [
  { href: "/backlog", label: "Backlog" },
  { href: "/context", label: "Contesto" },
  { href: "/agents", label: "Agents" },
  { href: "/reports", label: "Report" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);

  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  // Preserve repositoryId filter in backlog link if already in URL
  const repoFromUrl = searchParams.get("repositoryId");
  const backlogHref = repoFromUrl ? `/backlog?repositoryId=${repoFromUrl}` : "/backlog";

  return (
    <aside className="hidden w-56 flex-col border-r border-border bg-background md:flex">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-lg font-bold tracking-tight">Robin.dev</span>
      </div>

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
          <kbd className="rounded border border-border px-1 font-mono">N</kbd> Task rapida
        </p>
      </div>
    </aside>
  );
}
