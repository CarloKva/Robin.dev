"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";

type Tab = "sprint" | "backlog" | "board";

interface PlanningHeaderProps {
  activeSprintCount: number;
  backlogTaskCount: number;
  defaultTab?: Tab;
  onTabChange?: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; disabled?: boolean }[] = [
  { id: "sprint", label: "Sprint" },
  { id: "backlog", label: "Backlog" },
  { id: "board", label: "Board", disabled: true },
];

export function PlanningHeader({
  activeSprintCount,
  backlogTaskCount,
  defaultTab = "sprint",
  onTabChange,
}: PlanningHeaderProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const activeIndex = TABS.findIndex((t) => t.id === activeTab);
    const el = tabRefs.current[activeIndex];
    const container = containerRef.current;
    if (!el || !container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicatorStyle({
      left: elRect.left - containerRect.left,
      width: elRect.width,
    });
  }, [activeTab]);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Title + pills */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Planning</h1>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "rgba(0, 122, 255, 0.10)", color: "#007AFF" }}
        >
          {activeSprintCount} sprint {activeSprintCount === 1 ? "attivo" : "attivi"}
        </span>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {backlogTaskCount} task in backlog
        </span>
      </div>

      {/* Segmented control */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl bg-gray-100 p-1 dark:bg-[#2C2C2E] sm:w-auto"
      >
        {/* Sliding indicator */}
        <div
          className="absolute top-1 bottom-1 rounded-[10px] bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-[#3A3A3C]"
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          aria-hidden
        />

        <div className="relative flex">
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && handleTabClick(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-sm transition-colors duration-200",
                activeTab === tab.id
                  ? "font-medium text-gray-900 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                tab.disabled && "cursor-not-allowed opacity-60 hover:text-gray-500 dark:hover:text-gray-400"
              )}
            >
              {tab.label}
              {tab.disabled && (
                <span className="inline-flex items-center rounded-full bg-gray-200 px-1.5 py-px text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  Presto
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
