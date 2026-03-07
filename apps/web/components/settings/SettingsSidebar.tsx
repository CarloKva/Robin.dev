"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
}

const navItems: NavItem[] = [
  { id: "workspace", label: "Workspace" },
  { id: "connections", label: "Connessioni" },
  { id: "repositories", label: "Repository" },
  { id: "environments", label: "Ambienti" },
  { id: "mcp-servers", label: "MCP Servers" },
  { id: "notifications", label: "Notifiche" },
];

export function SettingsSidebar() {
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
  }, []);

  return (
    <nav className="hidden lg:block w-52 shrink-0">
      <div className="sticky top-6 space-y-1">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Impostazioni
        </p>
        {navItems.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              setActiveId(id);
            }}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              activeId === id
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
