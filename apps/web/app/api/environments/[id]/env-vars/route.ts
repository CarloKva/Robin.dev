/**
 * PUT /api/environments/[id]/env-vars — save encrypted env vars
 *
 * Accepts plaintext vars, encrypts them server-side, stores only ciphertext.
 * Never returns plaintext — response is always { ok: true }.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getEnvironmentById, saveEnvironmentEnvVars } from "@/lib/db/environments";
import { encryptEnvVars } from "@/lib/crypto/env-vars";

const bodySchema = z.object({
  vars: z.record(z.string(), z.string()),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { id } = await params;

  const existing = await getEnvironmentById(id, workspace.id);
  if (!existing) {
    return NextResponse.json({ error: "Environment not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const encrypted = encryptEnvVars(parsed.data.vars);
    await saveEnvironmentEnvVars(id, workspace.id, encrypted);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/environments/[id]/env-vars] error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to save env vars" }, { status: 500 });
  }
}
