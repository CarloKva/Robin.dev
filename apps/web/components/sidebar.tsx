"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Loader2,
  ListTodo,
  FileText,
  Bot,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/backlog", label: "Backlog", icon: ListTodo },
  { href: "/context", label: "Contesto", icon: FileText },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/reports", label: "Report", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const STORAGE_KEY = "sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  // Preserve repositoryId filter in backlog link if already in URL
  const repoFromUrl = searchParams.get("repositoryId");
  const backlogHref = repoFromUrl
    ? `/backlog?repositoryId=${repoFromUrl}`
    : "/backlog";

  const isCollapsed = mounted && collapsed;

  return (
    <aside
      className={`hidden flex-col border-r border-border bg-background md:flex overflow-hidden transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-56"
      }`}
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-border ${
          isCollapsed ? "justify-center px-0" : "px-4"
        }`}
      >
        {isCollapsed ? (
          <span className="text-lg font-bold tracking-tight">R</span>
        ) : (
          <span className="text-lg font-bold tracking-tight">Robin.dev</span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const href = item.href === "/backlog" ? backlogHref : item.href;
          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            // Mark Backlog active when on sprint detail pages
            (item.href === "/backlog" && pathname.startsWith("/sprints"));
          const isLoading = loadingHref === item.href;
          const Icon = item.icon;

          return (
            <div key={item.href} className="relative group/nav">
              <Link
                href={href}
                onClick={() => {
                  if (!isActive) setLoadingHref(item.href);
                }}
                className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isCollapsed ? "justify-center" : "justify-between"
                } ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <div
                  className={`flex items-center ${isCollapsed ? "" : "gap-2"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
                {isLoading && !isCollapsed && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
              </Link>
              {isLoading && isCollapsed && (
                <span className="pointer-events-none absolute right-1 top-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </span>
              )}
              {isCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 opacity-0 transition-opacity group-hover/nav:opacity-100">
                  <div className="rounded bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-md">
                    {item.label}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <button
          onClick={toggleCollapsed}
          className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
        {!isCollapsed && (
          <p className="mt-1 px-3 text-xs text-muted-foreground">
            <kbd className="rounded border border-border px-1 font-mono">N</kbd>{" "}
            Task rapida
          </p>
        )}
      </div>
    </aside>
  );
}
