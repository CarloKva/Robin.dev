import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getTemplatesForWorkspace, upsertTemplate } from "@/lib/db/task-templates";

const upsertSchema = z.object({
  task_type: z.enum(["bug", "feature", "docs", "refactor", "chore", "accessibility", "security"]),
  template_body: z.string().min(1).max(10000),
});

export async function GET() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const templates = await getTemplatesForWorkspace(workspace.id);
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const template = await upsertTemplate(workspace.id, parsed.data.task_type, parsed.data.template_body);
  if (!template) return NextResponse.json({ error: "Failed to save template" }, { status: 500 });

  return NextResponse.json({ template }, { status: 201 });
}
