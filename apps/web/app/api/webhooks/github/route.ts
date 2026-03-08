/**
 * POST /api/webhooks/github
 *
 * Receives GitHub App webhook events, verifies the HMAC-SHA256 signature,
 * resolves the workspace from the repository, and enqueues a job in the
 * github-events BullMQ queue for the control-plane orchestrator to process.
 *
 * Event routing:
 *   - pull_request_review_comment → inline diff comment handler (downstream)
 *   - issue_comment               → general PR comment handler (downstream)
 *   - pull_request (closed)       → PR closed/merged handler (downstream)
 *   - anything else               → logged + ignored (200)
 *
 * Responds 200 in all cases except invalid/missing signature (401).
 * Internal errors are logged and swallowed — never returns 500.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { getGitHubWebhookQueue } from "@/lib/queue/github-events.queue";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Verify the X-Hub-Signature-256 header from GitHub. */
function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Determine whether this event+action combination should be enqueued. */
function isHandledEvent(event: string, action?: string): boolean {
  if (event === "pull_request_review_comment") return true;
  if (event === "issue_comment") return true;
  if (event === "pull_request" && action === "closed") return true;
  if (event === "pull_request" && action === "opened") return true;
  return false;
}

export async function POST(request: Request) {
  const secret = process.env["GITHUB_WEBHOOK_SECRET"];
  if (!secret) {
    console.error("[GitHub Webhook] GITHUB_WEBHOOK_SECRET is not set — cannot verify signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery") ?? "unknown";

  if (!signature || !event) {
    console.warn("[GitHub Webhook] Missing signature or event header", { deliveryId });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = await request.text();

  if (!verifySignature(body, signature, secret)) {
    console.warn("[GitHub Webhook] Invalid signature for delivery", deliveryId);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    console.warn("[GitHub Webhook] Invalid JSON body for delivery", deliveryId);
    return NextResponse.json({ received: true });
  }

  const action = (payload["action"] as string | undefined);

  // Route by event type — log unhandled events and return early
  if (!isHandledEvent(event, action)) {
    console.log(`[GitHub Webhook] evento non gestito: ${event}`, { deliveryId, action });
    return NextResponse.json({ received: true });
  }

  // Resolve workspace from repository.full_name
  const repository = payload["repository"] as Record<string, unknown> | undefined;
  const repoFullName = repository?.["full_name"] as string | undefined;

  if (!repoFullName) {
    console.warn("[GitHub Webhook] No repository.full_name in payload", { deliveryId, event });
    return NextResponse.json({ received: true });
  }

  try {
    const db = createSupabaseAdminClient();
    const { data: repo, error } = await db
      .from("repositories")
      .select("id, workspace_id")
      .eq("full_name", repoFullName)
      .maybeSingle();

    if (error) {
      console.error(`[GitHub Webhook] DB error resolving repository: ${repoFullName}`, error.message);
      return NextResponse.json({ received: true });
    }

    if (!repo) {
      console.log(`[GitHub Webhook] repository non gestita: ${repoFullName}`);
      return NextResponse.json({ received: true });
    }

    const workspaceId = repo.workspace_id as string;

    // Enqueue the job — processing happens in the worker, not here
    const queue = getGitHubWebhookQueue();
    const jobName = action ? `${event}:${action}` : event;
    await queue.add(
      jobName,
      { event, deliveryId, workspaceId, repositoryFullName: repoFullName, payload },
      { jobId: `gh:${deliveryId}` } // deduplicate by delivery ID
    );

    console.log(`[GitHub Webhook] job enqueued: ${jobName}`, { deliveryId, repoFullName, workspaceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GitHub Webhook] Failed to resolve workspace or enqueue job:", msg, { deliveryId, event });
  }

  return NextResponse.json({ received: true });
}
