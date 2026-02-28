/**
 * GitHub App client utilities.
 *
 * Uses the Node.js built-in `crypto` module to sign JWTs — no extra deps.
 * All functions are server-side only (never imported in client components).
 */

import crypto from "crypto";

const GITHUB_API = "https://api.github.com";

// ─── JWT ────────────────────────────────────────────────────────────────────

/**
 * Creates a short-lived JWT for authenticating as the GitHub App itself.
 * Used to call /app/installations/* endpoints.
 * Expiry: 10 minutes (GitHub maximum).
 */
export function createGitHubAppJWT(): string {
  const appId = process.env["GITHUB_APP_ID"];
  const privateKeyB64 = process.env["GITHUB_APP_PRIVATE_KEY_B64"];

  if (!appId || !privateKeyB64) {
    throw new Error(
      "GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY_B64 must be set in environment"
    );
  }

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

// ─── Installation token ──────────────────────────────────────────────────────

/**
 * Exchanges App JWT for a short-lived installation access token (1h).
 * Never persisted — generated on demand before each GitHub API operation.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = createGitHubAppJWT();

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

// ─── Installation info ───────────────────────────────────────────────────────

type InstallationAccount = {
  id: number;
  login: string;
  type: "User" | "Organization";
};

type InstallationInfo = {
  id: number;
  account: InstallationAccount;
};

/**
 * Fetches metadata about a GitHub App installation.
 * Used during the OAuth callback to learn which account installed the app.
 */
export async function getInstallationInfo(installationId: number): Promise<InstallationInfo> {
  const jwt = createGitHubAppJWT();

  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to get installation info for ${installationId}: ${res.status} ${body}`
    );
  }

  return res.json() as Promise<InstallationInfo>;
}

// ─── Repository listing ──────────────────────────────────────────────────────

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
  description: string | null;
};

/**
 * Lists all repositories accessible to a given installation.
 * Handles pagination automatically (up to 1000 repos).
 */
export async function listInstallationRepos(installationId: number): Promise<GitHubRepo[]> {
  const token = await getInstallationToken(installationId);
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!res.ok) break;

    const data = (await res.json()) as {
      total_count: number;
      repositories: GitHubRepo[];
    };

    repos.push(...data.repositories);

    if (repos.length >= data.total_count) break;
    page++;
  }

  return repos;
}

// ─── List all App installations ──────────────────────────────────────────────

type AppInstallation = {
  id: number;
  account: InstallationAccount;
  created_at: string;
};

/**
 * Lists all installations of this GitHub App (across all accounts).
 * Used as a fallback to detect installations when the callback redirect fails.
 */
export async function listAppInstallations(): Promise<AppInstallation[]> {
  const jwt = createGitHubAppJWT();
  const installations: AppInstallation[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/app/installations?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!res.ok) break;

    const data = (await res.json()) as AppInstallation[];
    installations.push(...data);

    if (data.length < 100) break;
    page++;
  }

  return installations;
}

// ─── Installation URL ────────────────────────────────────────────────────────

/**
 * Returns the GitHub App installation URL (where users go to install the app).
 */
export function getGitHubAppInstallUrl(): string {
  const appName = process.env["GITHUB_APP_NAME"];
  if (!appName) throw new Error("GITHUB_APP_NAME must be set in environment");
  return `https://github.com/apps/${appName}/installations/new`;
}

// ─── Token validation ────────────────────────────────────────────────────────

/**
 * Validates that a GitHub App installation is still active.
 * Returns true if the installation is accessible, false if revoked/suspended.
 */
export async function validateInstallation(installationId: number): Promise<boolean> {
  try {
    const jwt = createGitHubAppJWT();
    const res = await fetch(`${GITHUB_API}/app/installations/${installationId}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}
