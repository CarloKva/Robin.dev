import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getContextDocuments, createContextDocument } from "@/lib/db/context";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

export async function GET() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const docs = await getContextDocuments(workspace.id);
  return NextResponse.json({ docs });
}

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

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
