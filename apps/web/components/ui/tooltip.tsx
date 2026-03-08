"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "right" | "left" | "top" | "bottom";
  className?: string;
}

export function Tooltip({ children, content, side = "right", className }: TooltipProps) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div
        className={cn(
          "pointer-events-none absolute z-50 opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100",
          side === "right" && "left-full top-1/2 -translate-y-1/2 ml-2",
          side === "left" && "right-full top-1/2 -translate-y-1/2 mr-2",
          side === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-2",
          side === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-2",
          className
        )}
      >
        <div className="rounded-lg bg-[#1C1C1E] dark:bg-[#2C2C2E] px-2 py-1 text-xs text-white whitespace-nowrap shadow-md">
          {content}
        </div>
      </div>
    </div>
  );
}
