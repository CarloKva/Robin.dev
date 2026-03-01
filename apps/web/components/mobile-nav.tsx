"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListTodo, Zap, BarChart2, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/backlog", label: "Backlog", icon: ListTodo },
  { href: "/sprints", label: "Sprint", icon: Zap },
  { href: "/metrics", label: "Metriche", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Bottom navigation bar shown on mobile (md: hidden).
 * Mirrors the sidebar nav for small viewports.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-background md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors min-h-[44px] ${
              isActive
                ? "text-brand-600 dark:text-brand-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
