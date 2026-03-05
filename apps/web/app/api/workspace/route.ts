import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { updateWorkspaceName } from "@/lib/db/workspace";

const patchSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function PATCH(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateWorkspaceName(workspace.id, parsed.data.name);
  if (!updated) {
    return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
  }

  return NextResponse.json({ workspace: updated });
}
