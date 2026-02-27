"use client";

import { useEffect, useState } from "react";

/**
 * Returns a human-readable relative time string (e.g. "2 minutes ago")
 * that auto-updates every minute.
 *
 * @param isoString - ISO 8601 timestamp string
 */
export function useRelativeTime(isoString: string): string {
  const [relative, setRelative] = useState(() => formatRelative(isoString));

  useEffect(() => {
    // Update immediately in case of hydration mismatch
    setRelative(formatRelative(isoString));

    const timer = setInterval(() => {
      setRelative(formatRelative(isoString));
    }, 60_000);

    return () => clearInterval(timer);
  }, [isoString]);

  return relative;
}

function formatRelative(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
