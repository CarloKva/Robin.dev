"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  ListTodo,
  BookOpen,
  Bot,
  BarChart2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS_PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/backlog", label: "Planning", icon: ListTodo },
  { href: "/context", label: "Context", icon: BookOpen },
  { href: "/agents", label: "Agents", icon: Bot },
];

const NAV_ITEMS_SECONDARY: NavItem[] = [
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const STORAGE_KEY = "sidebar-collapsed";

interface SidebarProps {
  workspaceName: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function Sidebar({ workspaceName }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const repoFromUrl = searchParams.get("repositoryId");
  const backlogHref = repoFromUrl ? `/backlog?repositoryId=${repoFromUrl}` : "/backlog";

  const isCollapsed = mounted && collapsed;
  const workspaceInitials = getInitials(workspaceName);

  const userName =
    user?.fullName ??
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ??
    user?.username ??
    "";
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  function renderNavItem(item: NavItem) {
    const href = item.href === "/backlog" ? backlogHref : item.href;
    const isActive =
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`) ||
      (item.href === "/backlog" && pathname.startsWith("/sprints"));
    const Icon = item.icon;

    const linkEl = (
      <Link
        href={href}
        className={`flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 ${
          isCollapsed ? "justify-center" : "gap-3"
        } ${
          isActive
            ? "bg-[#007AFF]/10 dark:bg-[#007AFF]/15 text-[#007AFF]"
            : "text-[#3A3A3C] dark:text-[#EBEBF5] hover:bg-gray-100 dark:hover:bg-[#2C2C2E]"
        }`}
      >
        <Icon
          className={`w-5 h-5 shrink-0 ${isActive ? "text-[#007AFF]" : ""}`}
          strokeWidth={1.5}
        />
        {!isCollapsed && <span>{item.label}</span>}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.href} content={item.label} side="right">
          {linkEl}
        </Tooltip>
      );
    }

    return <div key={item.href}>{linkEl}</div>;
  }

  return (
    <div className="relative hidden md:flex">
      <aside
        className={`flex flex-col border-r border-[#D1D1D6] dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] overflow-hidden transition-all duration-[250ms] ease-in-out ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Collapse toggle — top of sidebar */}
        <div className={`px-3 pt-3 pb-1 flex ${isCollapsed ? "justify-center" : "justify-end"}`}>
          <Tooltip content={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
            <button
              onClick={toggleCollapsed}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] hover:text-[#1C1C1E] dark:hover:text-white transition-colors duration-150"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
              ) : (
                <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
              )}
            </button>
          </Tooltip>
        </div>

        {/* Workspace block */}
        <div className={`px-3 pb-2 ${isCollapsed ? "flex justify-center" : ""}`}>
          <div
            className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors duration-150 ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-[10px] bg-[#007AFF] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {workspaceInitials}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-[#1C1C1E] dark:text-white truncate">
                    {workspaceName}
                  </span>
                  <span className="text-xs text-[#8E8E93]">Workspace</span>
                </div>
                <ChevronsUpDown className="w-4 h-4 text-[#8E8E93] flex-shrink-0" />
              </>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-2">
          {NAV_ITEMS_PRIMARY.map(renderNavItem)}

          {/* Separator */}
          <div className="mx-0 my-1 h-px bg-[#D1D1D6] dark:bg-[#38383A]" />

          {NAV_ITEMS_SECONDARY.map(renderNavItem)}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-[#D1D1D6] dark:border-[#38383A] pt-3 px-3 pb-3 flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          {!isCollapsed && (
            <>
              <div className="flex flex-col min-w-0 flex-1">
                {userName && (
                  <span className="text-sm font-medium text-[#1C1C1E] dark:text-white truncate">
                    {userName}
                  </span>
                )}
                {userEmail && (
                  <span className="text-xs text-[#8E8E93] truncate">{userEmail}</span>
                )}
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex-shrink-0">
                beta
              </span>
            </>
          )}
        </div>
      </aside>

    </div>
  );
}
