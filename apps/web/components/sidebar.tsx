"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  ListTodo,
  BookOpen,
  Bot,
  BarChart2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        workspaceRef.current &&
        !workspaceRef.current.contains(event.target as Node)
      ) {
        setWorkspaceOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
  const userInitials = userName
    ? userName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

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
        className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md min-h-[36px]",
          "transition-colors duration-150",
          isCollapsed && "justify-center gap-0",
          isActive
            ? "bg-accent text-foreground border-l-2 border-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <Icon size={16} className="shrink-0" />
        <span className={cn(!isCollapsed ? "block" : "sr-only")}>
          {item.label}
        </span>
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

  const settingsItem = { href: "/settings", label: "Settings", icon: Settings };

  return (
    <aside
      className={cn(
        "relative hidden md:flex flex-col h-screen sticky top-0",
        "bg-background border-r border-border overflow-hidden",
        "transition-[width] duration-150 ease-in-out",
        isCollapsed ? "w-14" : "w-60"
      )}
    >
      {/* Top bar: collapse toggle */}
      <div className={cn("px-2 pt-2 pb-1 flex", isCollapsed ? "justify-center" : "justify-end")}>
        <Tooltip content={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
          <button
            onClick={toggleCollapsed}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded-md",
              "text-muted-foreground hover:bg-accent hover:text-foreground",
              "transition-colors duration-150"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={15} />
            ) : (
              <PanelLeftClose size={15} />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Workspace switcher */}
      <div className="px-2 pb-2" ref={workspaceRef}>
        <button
          onClick={() => setWorkspaceOpen((o) => !o)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md",
            "text-sm font-medium hover:bg-accent transition-colors duration-150",
            isCollapsed && "justify-center px-2"
          )}
        >
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold shrink-0">
            {workspaceInitials}
          </div>
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left text-foreground truncate">
                {workspaceName}
              </span>
              <ChevronDown size={14} className="text-muted-foreground shrink-0" />
            </>
          )}
        </button>

        {workspaceOpen && !isCollapsed && (
          <div className="absolute left-2 right-2 top-[80px] z-50 rounded-md border border-border bg-background shadow-md p-1">
            <div className="px-2 py-1.5 rounded-md bg-accent">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold">
                  {workspaceInitials}
                </div>
                <span className="text-sm font-medium text-foreground truncate">
                  {workspaceName}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-2 overflow-y-auto">
        {NAV_ITEMS_PRIMARY.map(renderNavItem)}

        <div className="my-1 h-px bg-border" />

        {NAV_ITEMS_SECONDARY.map(renderNavItem)}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 pt-2 pb-3 flex flex-col gap-0.5">
        {/* Settings link */}
        {renderNavItem(settingsItem)}

        {/* User info */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 mt-1",
            isCollapsed && "justify-center px-2"
          )}
        >
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold shrink-0 overflow-hidden">
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.imageUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              userInitials
            )}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              {userName && (
                <span className="text-sm font-medium text-foreground truncate">
                  {userName}
                </span>
              )}
              {userEmail && (
                <span className="text-xs text-muted-foreground truncate">
                  {userEmail}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
