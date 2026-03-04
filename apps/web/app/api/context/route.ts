import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getContextDocuments, createContextDocument } from "@/lib/db/context";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const docs = await getContextDocuments(workspace.id);
  return NextResponse.json({ docs });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const doc = await createContextDocument(workspace.id, parsed.data);
    return NextResponse.json({ doc }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
