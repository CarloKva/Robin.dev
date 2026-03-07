"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/backlog": "Backlog",
  "/tasks": "Tasks",
  "/agents": "Agents",
  "/context": "Context",
  "/reports": "Reports",
  "/settings": "Settings",
  "/sprints": "Sprints",
  "/ops": "Ops",
  "/metrics": "Metrics",
};

interface HeaderProps {
  workspaceName: string;
  activeAgentsCount: number;
  /** Optional slot rendered in the right section (e.g. HeaderRepoSelector). */
  children?: React.ReactNode;
}

export function Header({ workspaceName, activeAgentsCount, children }: HeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Derive the current page label by matching the longest path prefix
  const currentPageLabel = (() => {
    const segments = pathname.split("/").filter(Boolean);
    for (let i = segments.length; i >= 1; i--) {
      const key = "/" + segments.slice(0, i).join("/");
      if (breadcrumbMap[key]) return breadcrumbMap[key];
    }
    return null;
  })();

  function handleCreate() {
    document.dispatchEvent(new CustomEvent("open-create-modal", { detail: { tab: "task" } }));
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-14 flex items-center justify-between px-4 md:px-6 backdrop-blur-xl border-b transition-all duration-200",
        "border-[#D1D1D6]/60 dark:border-[#38383A]/60",
        scrolled
          ? "bg-white/95 dark:bg-black/95 shadow-ios-sm"
          : "bg-white/80 dark:bg-black/80"
      )}
    >
      {/* Left — Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <span className="font-semibold text-[#1C1C1E] dark:text-white">
          {workspaceName}
        </span>
        {currentPageLabel && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-[#8E8E93]" />
            <span className="text-[#8E8E93]">{currentPageLabel}</span>
          </>
        )}
      </nav>

      {/* Center — Agent status pill (desktop only) */}
      {activeAgentsCount > 0 && (
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#2C2C2E] text-xs font-medium">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34C759]" />
          </span>
          <span className="text-[#3A3A3C] dark:text-[#EBEBF5]">
            {activeAgentsCount} {activeAgentsCount === 1 ? "agente attivo" : "agenti attivi"}
          </span>
        </div>
      )}

      {/* Right — optional children (repo selector etc) + create button + user */}
      <div className="flex items-center gap-2">
        {children}
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] h-9 px-4 text-sm font-medium text-white hover:bg-[#0071e3] shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          <span className="hidden sm:inline">Crea task</span>
        </button>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
