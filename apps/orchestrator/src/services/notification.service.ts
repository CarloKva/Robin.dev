import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

interface TaskInfo {
  id: string;
  title: string;
  workspaceId: string;
  prUrl?: string;
}

interface WorkspaceNotifyConfig {
  slackWebhookUrl: string | null;
  notifyEmail: string | null;
}

/**
 * Sends operational notifications via Slack webhook and Resend email.
 * All methods are fire-and-forget — they log errors but never throw,
 * so notification failures never break job processing.
 *
 * Per-workspace config is read from `workspace_settings` (notify_slack_webhook,
 * notify_email). Falls back to env vars SLACK_WEBHOOK_URL / NOTIFY_EMAIL.
 */
export class NotificationService {
  private readonly resendApiKey = process.env["RESEND_API_KEY"];
  private readonly appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

  /** Read per-workspace notification config from DB; fall back to env vars. */
  private async getWorkspaceConfig(workspaceId: string): Promise<WorkspaceNotifyConfig> {
    try {
      const db = getSupabaseClient();
      const { data } = await db
        .from("workspace_settings")
        .select("notify_slack_webhook, notify_email")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      return {
        slackWebhookUrl: data?.notify_slack_webhook ?? process.env["SLACK_WEBHOOK_URL"] ?? null,
        notifyEmail: data?.notify_email ?? process.env["NOTIFY_EMAIL"] ?? null,
      };
    } catch (err) {
      log.warn({ workspaceId, error: String(err) }, "getWorkspaceConfig: DB lookup failed, falling back to env");
      return {
        slackWebhookUrl: process.env["SLACK_WEBHOOK_URL"] ?? null,
        notifyEmail: process.env["NOTIFY_EMAIL"] ?? null,
      };
    }
  }

  async notifyTaskReady(task: TaskInfo): Promise<void> {
    const config = await this.getWorkspaceConfig(task.workspaceId);
    const text = `✅ *PR ready for review*\n*${task.title}*\n${task.prUrl ? `<${task.prUrl}|Open PR>` : ""}\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text, config.slackWebhookUrl);
    log.info({ taskId: task.id }, "Notification: task ready");
  }

  async notifyTaskBlocked(task: TaskInfo, reason: string): Promise<void> {
    const config = await this.getWorkspaceConfig(task.workspaceId);
    const text = `🚧 *Agent blocked — needs your input*\n*${task.title}*\n>${reason}\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text, config.slackWebhookUrl);
    await this.sendEmail({
      subject: `[Robin.dev] Agent blocked: ${task.title}`,
      html: `<p>The agent working on <strong>${task.title}</strong> is blocked and needs your input.</p><p><strong>Reason:</strong> ${reason}</p><p><a href="${this.appUrl}/tasks/${task.id}">View task →</a></p>`,
    }, config.notifyEmail);
    log.info({ taskId: task.id, reason }, "Notification: task blocked");
  }

  async notifyTaskFailed(task: TaskInfo, errorCode: string, message: string): Promise<void> {
    const config = await this.getWorkspaceConfig(task.workspaceId);
    const text = `❌ *Task failed*\n*${task.title}*\nError: \`${errorCode}\` — ${message}\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text, config.slackWebhookUrl);
    await this.sendEmail({
      subject: `[Robin.dev] Task failed: ${task.title}`,
      html: `<p>Task <strong>${task.title}</strong> failed.</p><p><strong>Error:</strong> ${errorCode} — ${message}</p><p><a href="${this.appUrl}/tasks/${task.id}">View task →</a></p>`,
    }, config.notifyEmail);
    log.info({ taskId: task.id, errorCode }, "Notification: task failed");
  }

  async notifyPrMerged(task: TaskInfo, prNumber: number): Promise<void> {
    const config = await this.getWorkspaceConfig(task.workspaceId);
    const text = `✅ *Task completata — PR #${prNumber} mergiata*\n*${task.title}*\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text, config.slackWebhookUrl);
    log.info({ taskId: task.id, prNumber }, "Notification: PR merged — task done");
  }

  async notifyPrClosedWithoutMerge(task: TaskInfo, prNumber: number): Promise<void> {
    const config = await this.getWorkspaceConfig(task.workspaceId);
    const text = `⚠️ *PR #${prNumber} chiusa senza merge*\n*${task.title}*\nLa task è tornata in review.\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text, config.slackWebhookUrl);
    await this.sendEmail({
      subject: `[Robin.dev] PR #${prNumber} chiusa senza merge: ${task.title}`,
      html: `<p>La PR <strong>#${prNumber}</strong> per la task <strong>${task.title}</strong> è stata chiusa senza merge.</p><p>La task è tornata in review.</p><p><a href="${this.appUrl}/tasks/${task.id}">View task →</a></p>`,
    }, config.notifyEmail);
    log.info({ taskId: task.id, prNumber }, "Notification: PR closed without merge");
  }

  /** DLQ alerts use env-only config — no workspaceId available. */
  async notifyDLQAlert(failedCount: number): Promise<void> {
    const text = `⚠️ *DLQ alert* — ${failedCount} failed jobs in queue\n<${this.appUrl}|Open Robin.dev>`;
    await this.sendSlack(text, process.env["SLACK_WEBHOOK_URL"] ?? null);
    log.warn({ failedCount }, "Notification: DLQ alert");
  }

  private async sendSlack(text: string, webhookUrl: string | null): Promise<void> {
    if (!webhookUrl) return;

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        log.warn({ status: res.status }, "Slack notification failed");
      }
    } catch (err) {
      log.warn({ error: String(err) }, "Slack notification threw");
    }
  }

  private async sendEmail(opts: { subject: string; html: string }, notifyEmail: string | null): Promise<void> {
    if (!this.resendApiKey || !notifyEmail) return;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Robin.dev <noreply@robin.dev>",
          to: [notifyEmail],
          subject: opts.subject,
          html: opts.html,
        }),
      });
      if (!res.ok) {
        log.warn({ status: res.status }, "Resend email failed");
      }
    } catch (err) {
      log.warn({ error: String(err) }, "Resend email threw");
    }
  }
}

export const notificationService = new NotificationService();
