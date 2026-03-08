"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Building2,
  Link,
  GitBranch,
  Bell,
  Server,
  Globe,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  iconBg: string;
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "workspace", label: "Workspace", icon: Building2, iconBg: "bg-[#8E8E93]" },
  { id: "connections", label: "Connessioni", icon: Link, iconBg: "bg-[#007AFF]" },
  { id: "repositories", label: "Repository", icon: GitBranch, iconBg: "bg-[#34C759]" },
  { id: "environments", label: "Ambienti", icon: Globe, iconBg: "bg-[#5856D6]" },
  { id: "mcp-servers", label: "MCP Servers", icon: Server, iconBg: "bg-[#FF9500]", ownerOnly: true },
  { id: "notifications", label: "Notifiche", icon: Bell, iconBg: "bg-[#FF9500]" },
];

interface SettingsSidebarProps {
  isOwner?: boolean;
}

export function SettingsSidebar({ isOwner }: SettingsSidebarProps) {
  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner),
    [isOwner]
  );

  const [activeId, setActiveId] = useState<string>("workspace");

  useEffect(() => {
    const observers = new Map<string, IntersectionObserver>();

    navItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting) setActiveId(id);
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
      );
      observer.observe(el);
      observers.set(id, observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [navItems]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-6">
          <ul className="space-y-0.5">
            {navItems.map(({ id, label, icon: Icon, iconBg }, index) => {
              const isActive = activeId === id;
              // Separator before "notifications" group
              const showSeparator = index > 0 && (id === "notifications" || id === "mcp-servers");

              return (
                <li key={id}>
                  {showSeparator && (
                    <div className="my-2 border-t border-[#D1D1D6]/60 dark:border-[#38383A]" />
                  )}
                  <button
                    onClick={() => scrollTo(id)}
                    className={cn(
                      "group w-full flex items-center gap-3 rounded-xl px-3 py-2 transition-colors text-left",
                      isActive
                        ? "bg-[#007AFF]/10"
                        : "hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50"
                    )}
                  >
                    {/* Colored icon square */}
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]",
                        isActive ? "bg-[#007AFF]" : iconBg
                      )}
                    >
                      <Icon
                        className="h-3.5 w-3.5 text-white"
                        strokeWidth={2}
                      />
                    </span>

                    {/* Label */}
                    <span
                      className={cn(
                        "flex-1 text-sm font-medium",
                        isActive
                          ? "text-[#007AFF]"
                          : "text-[#1C1C1E] dark:text-white"
                      )}
                    >
                      {label}
                    </span>

                    {/* Chevron */}
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        isActive
                          ? "text-[#007AFF]"
                          : "text-[#8E8E93]"
                      )}
                      strokeWidth={2.5}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Mobile tab bar */}
      <nav className="lg:hidden w-full overflow-x-auto pb-1 mb-4 -mx-1">
        <ul className="flex gap-1 px-1 min-w-max">
          {navItems.map(({ id, label, icon: Icon, iconBg }) => {
            const isActive = activeId === id;
            return (
              <li key={id}>
                <button
                  onClick={() => scrollTo(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-[#007AFF]/10 text-[#007AFF]"
                      : "bg-gray-100 dark:bg-[#2C2C2E] text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px]",
                      isActive ? "bg-[#007AFF]" : iconBg
                    )}
                  >
                    <Icon className="h-3 w-3 text-white" strokeWidth={2} />
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
