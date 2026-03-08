"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, ListTodo, FileText, Bot, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/backlog", label: "Planning", icon: ListTodo },
  { href: "/context", label: "Context", icon: FileText },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

interface MobileNavProps {
  badgeCounts?: Partial<Record<string, number>>;
}

/**
 * iOS-style frosted glass bottom tab bar shown on mobile (< md).
 * Active tab: #007AFF blue, filled icon, medium label.
 * Inactive tab: #8E8E93 gray, stroked icon, normal label.
 * Tap animation: micro bounce on the icon via .animate-tab-bounce.
 */
export function MobileNav({ badgeCounts = {} }: MobileNavProps) {
  const pathname = usePathname();
  const [bouncingHref, setBouncingHref] = useState<string | null>(null);

  const handleTabPress = (href: string) => {
    setBouncingHref(href);
    setTimeout(() => setBouncingHref(null), 250);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-[rgba(209,209,214,0.6)] dark:border-[rgba(56,56,58,0.6)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-[49px] items-stretch">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const isBouncing = bouncingHref === href;
          const badgeCount = badgeCounts[href] ?? 0;

          return (
            <Link
              key={href}
              href={href}
              onClick={() => handleTabPress(href)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[44px]"
            >
              <span
                className={`relative flex items-center justify-center${isBouncing ? " animate-tab-bounce" : ""}`}
                style={{ color: isActive ? "#007AFF" : "#8E8E93" }}
              >
                <Icon
                  size={24}
                  strokeWidth={isActive ? 0 : 1.5}
                  fill={isActive ? "currentColor" : "none"}
                />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-red-500 px-[3px] text-[9px] font-bold text-white leading-none">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span
                className="text-[10px] leading-none"
                style={{
                  color: isActive ? "#007AFF" : "#8E8E93",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
