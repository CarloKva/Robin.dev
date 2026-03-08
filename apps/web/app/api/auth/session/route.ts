import { NextResponse } from "next/server";
import { extractKVAAuth, upsertUserFromSSO, resolveWorkspaceId } from "@/lib/auth/sso";

/**
 * GET /api/auth/session
 *
 * Verifies the KVA SSO Bearer token and returns the synced user profile.
 * Called by the Room to confirm Robin Dev recognizes the token.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = extractKVAAuth(request);
  if (!auth.ok) return auth.response;

  const user = await upsertUserFromSSO(auth.ctx.ssoPayload);
  const workspaceId = await resolveWorkspaceId(auth.ctx.ssoPayload);

  return NextResponse.json({
    user: {
      id: user.kva_user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      kvaVentureId: user.kva_venture_id,
    },
    workspaceId,
    authenticated: true,
  });
}
