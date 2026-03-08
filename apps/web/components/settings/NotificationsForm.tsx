"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

  const initialEmailValue = initialEmail ?? "";
  const initialSlackValue = initialSlackWebhook ?? "";
  const isDirty = email !== initialEmailValue || slack !== initialSlackValue;

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
          <label htmlFor="notify_email" className="text-sm font-medium text-[#1C1C1E] dark:text-white">
            Email notifiche
          </label>
          {emailConfigured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#34C759]/10 px-2 py-0.5 text-[10px] font-medium text-[#34C759] border border-[#34C759]/30">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
              Configurata
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 py-0.5 text-[10px] font-medium text-[#8E8E93] border border-[#D1D1D6]/60 dark:border-[#38383A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8E8E93]" />
              Non impostata
            </span>
          )}
        </div>
        <Input
          id="notify_email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus("idle");
          }}
          placeholder="team@esempio.com"
        />
        <p className="text-xs text-[#8E8E93]">
          Ricevi notifiche email quando un task viene completato o richiede review.
        </p>
      </div>

      {/* Slack webhook */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="notify_slack" className="text-sm font-medium text-[#1C1C1E] dark:text-white">
            Slack Webhook
          </label>
          {slackConfigured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#34C759]/10 px-2 py-0.5 text-[10px] font-medium text-[#34C759] border border-[#34C759]/30">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
              Configurato
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 py-0.5 text-[10px] font-medium text-[#8E8E93] border border-[#D1D1D6]/60 dark:border-[#38383A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8E8E93]" />
              Non impostato
            </span>
          )}
        </div>
        <Input
          id="notify_slack"
          type="url"
          value={slack}
          onChange={(e) => {
            setSlack(e.target.value);
            setStatus("idle");
          }}
          placeholder="https://hooks.slack.com/services/..."
        />
        <p className="text-xs text-[#8E8E93]">
          URL webhook Incoming di Slack per ricevere notifiche nel tuo canale.
        </p>
      </div>

      {/* Save button — visible only on dirty state */}
      <div
        className={cn(
          "flex items-center justify-end gap-3 transition-all duration-200",
          isDirty ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
        )}
      >
        {status === "saved" && (
          <span className="flex items-center gap-1.5 text-xs text-[#34C759]">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            Salvato
          </span>
        )}
        {status === "error" && (
          <span className="text-xs text-[#FF3B30]">{errorMsg}</span>
        )}
        <button
          type="submit"
          disabled={isPending || !isDirty}
          className="rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? "Salvataggio..." : "Salva notifiche"}
        </button>
      </div>
    </form>
  );
}
