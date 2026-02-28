/**
 * GET /api/auth/github/callback
 *
 * GitHub App sends the founder here after installation with:
 *   ?installation_id={id}&setup_action=install|update
 *
 * Saves the installation_id to github_connections and redirects to Settings.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { upsertGitHubConnection } from "@/lib/db/github";
import { getInstallationInfo } from "@/lib/github/app";

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(`${APP_URL}/sign-in`);
  }

  const { searchParams } = request.nextUrl;
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");

  // Only process installs and updates
  if (!installationId || !["install", "update"].includes(setupAction ?? "")) {
    return NextResponse.redirect(
      `${APP_URL}/settings?github_error=invalid_callback`
    );
  }

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.redirect(`${APP_URL}/onboarding/workspace`);
  }

  try {
    const installId = parseInt(installationId, 10);

    // Fetch installation metadata to know which account installed the app
    const info = await getInstallationInfo(installId);

    await upsertGitHubConnection({
      workspaceId: workspace.id,
      installationId: installId,
      githubAccountId: info.account.id,
      githubAccountLogin: info.account.login,
      githubAccountType: info.account.type,
    });

    return NextResponse.redirect(
      `${APP_URL}/settings?github_connected=true`
    );
  } catch (err) {
    console.error("[GET /api/auth/github/callback]", err);
    return NextResponse.redirect(
      `${APP_URL}/settings?github_error=connection_failed`
    );
  }
}
