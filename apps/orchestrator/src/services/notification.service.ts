import { log } from "../utils/logger";

interface TaskInfo {
  id: string;
  title: string;
  workspaceId: string;
  prUrl?: string;
}

/**
 * Sends operational notifications via Slack webhook and Resend email.
 * All methods are fire-and-forget — they log errors but never throw,
 * so notification failures never break job processing.
 */
export class NotificationService {
  private readonly slackWebhookUrl = process.env["SLACK_WEBHOOK_URL"];
  private readonly resendApiKey = process.env["RESEND_API_KEY"];
  private readonly notifyEmail = process.env["NOTIFY_EMAIL"];
  private readonly appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

  async notifyTaskReady(task: TaskInfo): Promise<void> {
    const text = `✅ *PR ready for review*\n*${task.title}*\n${task.prUrl ? `<${task.prUrl}|Open PR>` : ""}\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text);
    log.info({ taskId: task.id }, "Notification: task ready");
  }

  async notifyTaskBlocked(task: TaskInfo, reason: string): Promise<void> {
    const text = `🚧 *Agent blocked — needs your input*\n*${task.title}*\n>${reason}\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text);
    await this.sendEmail({
      subject: `[Robin.dev] Agent blocked: ${task.title}`,
      html: `<p>The agent working on <strong>${task.title}</strong> is blocked and needs your input.</p><p><strong>Reason:</strong> ${reason}</p><p><a href="${this.appUrl}/tasks/${task.id}">View task →</a></p>`,
    });
    log.info({ taskId: task.id, reason }, "Notification: task blocked");
  }

  async notifyTaskFailed(task: TaskInfo, errorCode: string, message: string): Promise<void> {
    const text = `❌ *Task failed*\n*${task.title}*\nError: \`${errorCode}\` — ${message}\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text);
    await this.sendEmail({
      subject: `[Robin.dev] Task failed: ${task.title}`,
      html: `<p>Task <strong>${task.title}</strong> failed.</p><p><strong>Error:</strong> ${errorCode} — ${message}</p><p><a href="${this.appUrl}/tasks/${task.id}">View task →</a></p>`,
    });
    log.info({ taskId: task.id, errorCode }, "Notification: task failed");
  }

  async notifyPrMerged(task: TaskInfo, prNumber: number): Promise<void> {
    const text = `✅ *Task completata — PR #${prNumber} mergiata*\n*${task.title}*\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text);
    log.info({ taskId: task.id, prNumber }, "Notification: PR merged — task done");
  }

  async notifyPrClosedWithoutMerge(task: TaskInfo, prNumber: number): Promise<void> {
    const text = `⚠️ *PR #${prNumber} chiusa senza merge*\n*${task.title}*\nLa task è tornata in review.\n<${this.appUrl}/tasks/${task.id}|View task>`;
    await this.sendSlack(text);
    await this.sendEmail({
      subject: `[Robin.dev] PR #${prNumber} chiusa senza merge: ${task.title}`,
      html: `<p>La PR <strong>#${prNumber}</strong> per la task <strong>${task.title}</strong> è stata chiusa senza merge.</p><p>La task è tornata in review.</p><p><a href="${this.appUrl}/tasks/${task.id}">View task →</a></p>`,
    });
    log.info({ taskId: task.id, prNumber }, "Notification: PR closed without merge");
  }

  async notifyDLQAlert(failedCount: number): Promise<void> {
    const text = `⚠️ *DLQ alert* — ${failedCount} failed jobs in queue\n<${this.appUrl}|Open Robin.dev>`;
    await this.sendSlack(text);
    log.warn({ failedCount }, "Notification: DLQ alert");
  }

  private async sendSlack(text: string): Promise<void> {
    if (!this.slackWebhookUrl) return;

    try {
      const res = await fetch(this.slackWebhookUrl, {
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

  private async sendEmail(opts: { subject: string; html: string }): Promise<void> {
    if (!this.resendApiKey || !this.notifyEmail) return;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Robin.dev <noreply@robin.dev>",
          to: [this.notifyEmail],
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
