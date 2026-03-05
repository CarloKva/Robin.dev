import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getSprintsForWorkspace } from "@/lib/db/sprints";

const createSprintSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(500).optional(),
});

function generateSprintName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(
    ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7
  );
  return `Sprint W${String(week).padStart(2, "0")}-${year}`;
}

export async function GET() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const sprints = await getSprintsForWorkspace(workspace.id);
  return NextResponse.json({ sprints });
}

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const body = await request.json().catch(() => ({}));
  const parsed = createSprintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: sprint, error } = await supabase
    .from("sprints")
    .insert({
      workspace_id: workspace.id,
      name: parsed.data.name ?? generateSprintName(),
      ...(parsed.data.goal !== undefined && { goal: parsed.data.goal }),
      status: "planning",
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/sprints]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sprint }, { status: 201 });
}
