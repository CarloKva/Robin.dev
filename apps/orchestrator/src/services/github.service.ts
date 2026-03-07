/**
 * GitHub App authentication for the orchestrator.
 * Generates installation tokens for git clone operations during provisioning.
 */

import crypto from "crypto";

const GITHUB_API = "https://api.github.com";

function createGitHubAppJWT(appId: string, privateKeyB64: string): string {
  const privateKey = Buffer.from(privateKeyB64, "base64").toString("utf-8");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId })
  ).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, "base64url");

  return `${header}.${payload}.${signature}`;
}

/**
 * Generates a short-lived (1h) installation access token for git operations.
 */
export async function getInstallationToken(
  appId: string,
  privateKeyB64: string,
  installationId: number
): Promise<string> {
  const jwt = createGitHubAppJWT(appId, privateKeyB64);

  const res = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to get installation token for installation ${installationId}: ${res.status} ${body}`
    );
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

/**
 * Enables auto-merge on a pull request via the GitHub REST API.
 * Requires branch protection rules to be enabled on the target branch.
 *
 * Does NOT throw on failure — a failed auto-merge enable should not block the task.
 */
export async function enableAutoMerge(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  mergeMethod: "merge" | "squash" | "rebase" = "squash"
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/auto-merge`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ merge_method: mergeMethod }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `enableAutoMerge failed for ${owner}/${repo}#${prNumber}: ${res.status} ${body}`
    );
  }
}
