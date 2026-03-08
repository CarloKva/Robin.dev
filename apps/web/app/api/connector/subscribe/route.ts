import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractKVAAuth, upsertUserFromSSO } from "@/lib/auth/sso";
import type { SubscribeResponse, WebhookSubscription } from "@/types/connector";

const subscribeSchema = z.object({
  url: z.string().url(),
  events: z
    .array(z.enum(["project.created", "agent.completed", "output.ready"]))
    .min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  const auth = extractKVAAuth(request);
  if (!auth.ok) return auth.response;

  await upsertUserFromSSO(auth.ctx.ssoPayload);

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { url, events } = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("connector_webhook_subscriptions")
    .insert({ url, events, active: true })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/connector/subscribe] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response: SubscribeResponse = { subscription: data as WebhookSubscription };
  return NextResponse.json(response, { status: 201 });
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = extractKVAAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("connector_webhook_subscriptions")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriptions: data ?? [] });
}
