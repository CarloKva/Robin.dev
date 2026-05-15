import { Trophy } from 'lucide-react';

/**
 * V2 deferral marker (spec §Out-of-scope.5). The leaderboard surface has no
 * backend yet — render a calm placeholder rather than a "coming soon" toast
 * so the panel doesn't feel broken.
 */
export function LeaderboardRailStub() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-divider bg-popover lg:flex">
      <div className="border-b border-divider px-4 py-3 text-xs font-semibold text-ink">
        Leaderboard
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Trophy size={20} />
        </span>
        <p className="text-sm font-semibold text-ink">Coming in v2</p>
        <p className="text-xs text-ink3">
          Standings, achievements, and weekly podiums will land once we&rsquo;ve
          shipped the activity aggregation layer.
        </p>
      </div>
    </aside>
  );
}
