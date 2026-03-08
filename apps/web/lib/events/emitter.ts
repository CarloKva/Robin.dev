// =============================================================================
// Robin.dev — Connector event emitter
// Dispatches ConnectorEvents to all registered KVA Room webhook subscriptions.
// =============================================================================

import { createHmac } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ConnectorEvent, ConnectorEventType, WebhookSubscription } from "@/types/connector";

// ---------------------------------------------------------------------------
// Signature helpers
// ---------------------------------------------------------------------------

/**
 * Produces an HMAC-SHA256 hex signature for a webhook payload.
 * The Room can verify it against CONNECTOR_WEBHOOK_SECRET.
 */
function signPayload(body: string): string {
  const secret = process.env["CONNECTOR_WEBHOOK_SECRET"];
  if (!secret) return "";
  return createHmac("sha256", secret).update(body).digest("hex");
}

// ---------------------------------------------------------------------------
// Core emitter
// ---------------------------------------------------------------------------

/**
 * Emits a ConnectorEvent to all active webhook subscribers that are
 * listening for the given event type.
 *
 * Fire-and-forget: delivery failures are logged but not rethrown, so
 * the caller is never blocked by a misbehaving Room endpoint.
 */
export async function emitConnectorEvent(event: ConnectorEvent): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: subscriptions, error } = await supabase
    .from("connector_webhook_subscriptions")
    .select("*")
    .eq("active", true)
    .contains("events", [event.event]);

  if (error) {
    console.error("[emitter] Failed to load subscriptions:", error.message);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) return;

  const body = JSON.stringify(event);
  const signature = signPayload(body);

  await Promise.allSettled(
    (subscriptions as WebhookSubscription[]).map((sub) =>
      fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Robin-Signature": signature,
          "X-Robin-Event": event.event,
          "X-Robin-Source": "robin-dev",
        },
        body,
      }).then((res) => {
        if (!res.ok) {
          console.warn(
            `[emitter] Webhook delivery failed for ${sub.url}: HTTP ${res.status}`
          );
        }
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Typed event builders — convenience wrappers
// ---------------------------------------------------------------------------

export function buildEvent(
  type: ConnectorEventType,
  entityId: string,
  entityType: string,
  payload: Record<string, unknown>
): ConnectorEvent {
  return {
    event: type,
    entityId,
    entityType,
    payload,
    timestamp: new Date().toISOString(),
    source: "robin-dev",
  };
}
