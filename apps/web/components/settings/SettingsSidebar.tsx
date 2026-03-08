"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  danger?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "general", label: "General" },
  { id: "github", label: "GitHub" },
  { id: "agents", label: "Agents" },
  { id: "billing", label: "Billing" },
  { id: "danger-zone", label: "Danger Zone", danger: true },
];

interface SettingsSidebarProps {
  isOwner?: boolean;
}

export function SettingsSidebar({ isOwner: _isOwner }: SettingsSidebarProps) {
  const navItems = useMemo(() => NAV_ITEMS, []);

  const [activeId, setActiveId] = useState<string>("general");

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
      <nav className="hidden lg:block col-span-1">
        <div className="sticky top-6 space-y-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Impostazioni
          </p>
          {navItems.map(({ id, label, danger }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(id);
              }}
              className={cn(
                "block rounded-md px-3 py-1.5 text-sm transition-colors cursor-pointer",
                danger
                  ? activeId === id
                    ? "text-destructive bg-destructive/10 font-medium"
                    : "text-destructive hover:text-destructive hover:bg-destructive/10"
                  : activeId === id
                    ? "text-foreground bg-accent font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* Mobile scroll nav */}
      <nav className="lg:hidden w-full overflow-x-auto pb-1 mb-4">
        <div className="flex gap-1 min-w-max">
          {navItems.map(({ id, label, danger }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(id);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer",
                danger
                  ? activeId === id
                    ? "text-destructive bg-destructive/10"
                    : "text-destructive hover:bg-destructive/10"
                  : activeId === id
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground bg-muted hover:text-foreground"
              )}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
