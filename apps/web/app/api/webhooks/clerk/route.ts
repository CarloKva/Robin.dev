import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    email_addresses: { email_address: string; id: string }[];
  };
}

function generateSlug(event: ClerkUserCreatedEvent["data"]): string {
  const base =
    event.username ??
    event.email_addresses[0]?.email_address.split("@")[0] ??
    event.id;

  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function generateName(event: ClerkUserCreatedEvent["data"]): string {
  if (event.first_name) {
    const full = [event.first_name, event.last_name].filter(Boolean).join(" ");
    return `${full}'s Workspace`;
  }
  if (event.username) return `${event.username}'s Workspace`;
  return "My Workspace";
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Clerk Webhook] CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await request.text();

  let event: ClerkUserCreatedEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch (err) {
    console.error("[Clerk Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "user.created") {
    return NextResponse.json({ received: true });
  }

  const userId = event.data.id;
  const name = generateName(event.data);
  let slug = generateSlug(event.data);

  try {
    const existing = await prisma.workspace_members.findFirst({
      where: { user_id: userId },
    });
    if (existing) {
      console.log(`[Clerk Webhook] Workspace already exists for user ${userId}, skipping`);
      return NextResponse.json({ received: true });
    }

    // If slug is taken, append a random suffix
    const slugTaken = await prisma.workspaces.findUnique({ where: { slug } });
    if (slugTaken) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ws = await tx.workspaces.create({
        data: { name, slug },
      });
      await tx.workspace_members.create({
        data: {
          workspace_id: ws.id,
          user_id: userId,
          role: "owner",
        },
      });
    });

    console.log(`[Clerk Webhook] Workspace "${slug}" created for user ${userId}`);
    return NextResponse.json({ received: true }, { status: 201 });
  } catch (error) {
    console.error("[Clerk Webhook] Failed to create workspace:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
