"use client";

import { useState, useTransition } from "react";

interface NotificationsFormProps {
  initialEmail: string | null;
  initialSlackWebhook: string | null;
}

export function NotificationsForm({
  initialEmail,
  initialSlackWebhook,
}: NotificationsFormProps) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [slack, setSlack] = useState(initialSlackWebhook ?? "");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("idle");
    setErrorMsg(null);

    startTransition(async () => {
      const body: Record<string, string | null> = {
        notify_email: email.trim() || null,
        notify_slack_webhook: slack.trim() || null,
      };

      const res = await fetch("/api/workspace/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg((data as { error?: string }).error ?? "Errore durante il salvataggio.");
      }
    });
  }

  const emailConfigured = !!initialEmail;
  const slackConfigured = !!initialSlackWebhook;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email notification */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="notify_email" className="text-sm font-medium text-foreground">
            Email notifiche
          </label>
          {emailConfigured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Configurata
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              Non impostata
            </span>
          )}
        </div>
        <input
          id="notify_email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus("idle");
          }}
          placeholder="team@esempio.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Ricevi notifiche email quando un task viene completato o richiede review.
        </p>
      </div>

      {/* Slack webhook */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="notify_slack" className="text-sm font-medium text-foreground">
            Slack Webhook
          </label>
          {slackConfigured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Configurato
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              Non impostato
            </span>
          )}
        </div>
        <input
          id="notify_slack"
          type="url"
          value={slack}
          onChange={(e) => {
            setSlack(e.target.value);
            setStatus("idle");
          }}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          URL webhook Incoming di Slack per ricevere notifiche nel tuo canale.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity disabled:opacity-50"
        >
          {isPending ? "Salvataggio..." : "Salva notifiche"}
        </button>
        {status === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            Salvato
          </span>
        )}
        {status === "error" && (
          <span className="text-sm text-destructive">{errorMsg}</span>
        )}
      </div>
    </form>
  );
}
