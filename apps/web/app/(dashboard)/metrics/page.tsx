import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getWorkspaceMetrics, type MetricsPeriod } from "@/lib/db/metrics";
import { MetricsClient } from "./MetricsClient";

interface MetricsPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function MetricsPage({ searchParams }: MetricsPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const { period: rawPeriod } = await searchParams;
  const period: MetricsPeriod =
    rawPeriod === "7d" || rawPeriod === "30d" || rawPeriod === "90d" ? rawPeriod : "30d";

  const metrics = await getWorkspaceMetrics(workspace.id, period);

  // Format current month for report export
  const now = new Date();
  const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metriche</h1>
          <p className="text-sm text-muted-foreground">
            Performance dell&apos;agente nel periodo selezionato.
          </p>
        </div>
        <a
          href={`/api/reports/monthly?month=${reportMonth}`}
          download={`robindev-report-${reportMonth}.md`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          Esporta report
        </a>
      </div>

      <MetricsClient metrics={metrics} currentPeriod={period} />
    </div>
  );
}
