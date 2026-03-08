"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricType = "completed" | "queue" | "attention";

const SEMANTIC = {
  completed: { color: "#34C759", Icon: CheckCircle2 },
  queue: { color: "#007AFF", Icon: Clock },
  attention: { color: "#FF9500", Icon: AlertCircle },
} as const;

interface MetricsTileProps {
  value: number;
  label: string;
  type: MetricType;
  sparkline: number[];
  className?: string;
}

function useCountUp(target: number, duration = 1000): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }
    const start = performance.now();
    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height: 32 }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max((v / max) * 100, 8)}%`,
            backgroundColor: color,
            opacity: i === values.length - 1 ? 1 : 0.6,
          }}
        />
      ))}
    </div>
  );
}

export function MetricsTile({
  value,
  label,
  type,
  sparkline,
  className,
}: MetricsTileProps) {
  const { color, Icon } = SEMANTIC[type];
  const count = useCountUp(value);

  return (
    <div
      className={cn(
        "rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-5 flex flex-col gap-3",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-4xl font-bold leading-none"
            style={{ color }}
          >
            {count}
          </p>
          <p className="mt-1 text-sm text-[#8E8E93]">{label}</p>
        </div>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1A` }}
        >
          <Icon size={18} style={{ color }} />
        </span>
      </div>
      <Sparkline values={sparkline} color={color} />
    </div>
  );
}

/** Skeleton placeholder shown during initial fetch. */
export function MetricsTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-5 animate-pulse flex flex-col gap-3",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="h-10 w-16 rounded bg-muted" />
          <div className="mt-2 h-4 w-32 rounded bg-muted" />
        </div>
        <div className="h-9 w-9 rounded-full bg-muted" />
      </div>
      <div className="h-8 rounded bg-muted" />
    </div>
  );
}
