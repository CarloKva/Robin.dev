import { AgentHeroSkeleton } from "@/components/dashboard/AgentHeroSection";
import { MetricsTileSkeleton } from "@/components/dashboard/MetricsTile";
import { ActiveTaskSkeleton } from "@/components/dashboard/ActiveTaskCard";
import { WorkspaceFeedSkeleton } from "@/components/dashboard/WorkspaceFeed";

/**
 * Skeleton loading state for the dashboard.
 * Next.js App Router renders this automatically while the Server Component fetches data.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <AgentHeroSkeleton />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricsTileSkeleton />
        <MetricsTileSkeleton />
        <MetricsTileSkeleton />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActiveTaskSkeleton />
        <WorkspaceFeedSkeleton />
      </div>
    </div>
  );
}
