import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { deleteContextDocuments } from "@/lib/db/context";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await deleteContextDocuments(workspace.id, parsed.data.ids);
    return NextResponse.json({ ok: true, deleted: parsed.data.ids.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete";
    console.error("[POST /api/context/bulk-delete] error:", message);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
