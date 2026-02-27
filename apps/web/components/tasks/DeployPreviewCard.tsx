import { ExternalLink, Loader2, CheckCircle2, AlertCircle, Globe } from "lucide-react";
import type { DeployData } from "@robin/shared-types";

interface DeployPreviewCardProps {
  data: DeployData;
}

const statusConfig = {
  building: {
    label: "In costruzione…",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Loader2,
    iconClass: "animate-spin text-amber-500",
  },
  ready: {
    label: "Pronta",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
  error: {
    label: "Errore",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: AlertCircle,
    iconClass: "text-red-500",
  },
} as const;

/**
 * Deploy preview card shown in task detail when a staging deploy exists.
 * Reads from the agent.deploy.staging event payload via TaskProjectedState.deployData.
 */
export function DeployPreviewCard({ data }: DeployPreviewCardProps) {
  const conf = statusConfig[data.deploy_status];
  const Icon = conf.icon;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold text-foreground">Deploy Preview</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${conf.badgeClass}`}
        >
          <Icon className={`h-3 w-3 ${conf.iconClass}`} />
          {conf.label}
        </span>
      </div>

      {/* Error message */}
      {data.deploy_status === "error" && data.error_message && (
        <div className="border-t border-border bg-red-50 px-4 py-2 dark:bg-red-950/30">
          <p className="text-xs text-red-600 dark:text-red-400">{data.error_message}</p>
        </div>
      )}

      {/* Link — shown when ready */}
      {data.deploy_status === "ready" && (
        <div className="border-t border-border px-4 py-2.5">
          <a
            href={data.deploy_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Apri preview
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Building state */}
      {data.deploy_status === "building" && (
        <div className="border-t border-border px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            Vercel sta deployando — pronto tra poco.
          </p>
        </div>
      )}
    </div>
  );
}
