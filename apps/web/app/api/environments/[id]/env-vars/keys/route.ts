/**
 * GET /api/environments/[id]/env-vars/keys
 *
 * Returns only the key names of stored env vars (never the values).
 * Used to show which variables are configured without revealing secrets.
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getEnvironmentById } from "@/lib/db/environments";
import { decryptEnvVars } from "@/lib/crypto/env-vars";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { id } = await params;

  const environment = await getEnvironmentById(id, workspace.id);
  if (!environment) {
    return NextResponse.json({ error: "Environment not found" }, { status: 404 });
  }

  if (!environment.env_vars_encrypted) {
    return NextResponse.json({ keys: [] });
  }

  try {
    const vars = decryptEnvVars(environment.env_vars_encrypted);
    return NextResponse.json({ keys: Object.keys(vars) });
  } catch (err) {
    console.error("[GET /api/environments/[id]/env-vars/keys] error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to read env var keys" }, { status: 500 });
  }
}
