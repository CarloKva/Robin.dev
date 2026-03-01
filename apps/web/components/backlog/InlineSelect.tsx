"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
  className?: string;
}

interface InlineSelectProps {
  value: string | null | undefined;
  options: Option[];
  onSelect: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function InlineSelect({
  value,
  options,
  onSelect,
  placeholder = "—",
  triggerClassName,
  disabled = false,
}: InlineSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          current?.className,
          triggerClassName
        )}
      >
        {current?.label ?? placeholder}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-md border border-border bg-popover shadow-md">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-xs font-medium",
                "hover:bg-accent hover:text-accent-foreground",
                "transition-colors",
                opt.value === value && "bg-accent/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
