// =============================================================================
// Robin.dev — KVA SSO: JWT verification + user sync
// =============================================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { KVASSOPayload, KVAConnectorUser } from "@/types/connector";

// ---------------------------------------------------------------------------
// JWT HS256 verification (no external dependency)
// ---------------------------------------------------------------------------

function base64UrlDecode(str: string): Buffer {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Verifies a HS256-signed JWT against the KVA_SSO_SECRET env variable.
 * Throws on invalid signature, malformed token, or expiry.
 */
export function verifyKVAJwt(token: string): KVASSOPayload {
  const secret = process.env["KVA_SSO_SECRET"];
  if (!secret) {
    throw new Error("KVA_SSO_SECRET is not configured");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT: expected 3 parts");
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const signingInput = `${headerB64}.${payloadB64}`;
  const hmac = createHmac("sha256", secret);
  hmac.update(signingInput);
  const expectedSig = hmac.digest();
  const receivedSig = base64UrlDecode(signatureB64);

  // Constant-time comparison to prevent timing attacks
  if (
    expectedSig.length !== receivedSig.length ||
    !timingSafeEqual(expectedSig, receivedSig)
  ) {
    throw new Error("Invalid JWT signature");
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8")) as KVASSOPayload;

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("JWT expired");
  }

  return payload;
}

// ---------------------------------------------------------------------------
// withKVAAuth — route-level auth guard
// ---------------------------------------------------------------------------

export type KVAAuthContext = {
  ssoPayload: KVASSOPayload;
};

/**
 * Extracts and verifies the KVA Bearer token from the request.
 * Returns the decoded payload or a 401 NextResponse.
 */
export function extractKVAAuth(
  request: Request
): { ok: true; ctx: KVAAuthContext } | { ok: false; response: NextResponse } {
  // Diagnostic logs removed — connector verified working in production.

  // Use X-KVA-Token instead of Authorization: Bearer to avoid Clerk
  // intercepting the header even on public routes (Clerk reads Authorization
  // regardless of route protection status — by design).
  const token = request.headers.get("X-KVA-Token");
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing X-KVA-Token header" },
        { status: 401 }
      ),
    };
  }

  try {
    const ssoPayload = verifyKVAJwt(token);
    return { ok: true, ctx: { ssoPayload } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token verification failed";
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 401 }),
    };
  }
}

// ---------------------------------------------------------------------------
// upsertUserFromSSO — sync KVA user into local DB
// ---------------------------------------------------------------------------

/**
 * Creates or updates a kva_connector_users record from the SSO JWT payload.
 * Called on every authenticated request to keep the local record fresh.
 */
export async function upsertUserFromSSO(
  payload: KVASSOPayload
): Promise<KVAConnectorUser> {
  const supabase = createSupabaseAdminClient();

  const record = {
    kva_user_id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    kva_venture_id: payload.kvaVentureId,
    updated_at: new Date().toISOString(),
    ...(payload.workspaceId !== undefined && { workspace_id: payload.workspaceId }),
  };

  const { data, error } = await supabase
    .from("kva_connector_users")
    .upsert(record, { onConflict: "kva_user_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert KVA user: ${error.message}`);
  }

  return data as KVAConnectorUser;
}

// ---------------------------------------------------------------------------
// resolveWorkspaceId — derive workspace from SSO context
// ---------------------------------------------------------------------------

/**
 * Resolves the Robin Dev workspace ID for a KVA user.
 * Prefers the workspaceId field in the JWT; falls back to the DB record.
 * Returns null if the user has no associated workspace.
 */
export async function resolveWorkspaceId(
  payload: KVASSOPayload
): Promise<string | null> {
  if (payload.workspaceId) {
    return payload.workspaceId;
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("kva_connector_users")
    .select("workspace_id")
    .eq("kva_user_id", payload.sub)
    .single();

  return (data as { workspace_id: string | null } | null)?.workspace_id ?? null;
}
