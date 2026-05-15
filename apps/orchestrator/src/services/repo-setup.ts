import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getInstallationToken } from "./github.service";
import { log } from "../utils/logger";

export type RepoSetupOptions = {
  repositoryId: string;
  repoUrl: string;
  defaultBranch: string;
};

export type RepoSetupResult = {
  repoPath: string;
  defaultBranch: string;
  headSha: string;
};

const REPO_ROOT = process.env["REPO_ROOT"] ?? "/home/agent/repos";

/** Git ref/branch name allowed characters per `git check-ref-format(1)`. We
 * accept a conservative subset so user-controlled `default_branch` values from
 * the DB cannot become shell arguments. */
const SAFE_BRANCH = /^[A-Za-z0-9._/\-]{1,200}$/;

function assertSafeBranch(branch: string): void {
  if (!SAFE_BRANCH.test(branch) || branch.startsWith("-")) {
    throw new Error(`repo-setup: unsafe branch name rejected: ${JSON.stringify(branch)}`);
  }
}

/**
 * Prepare a working tree for a maintenance/discovery run.
 *
 * Read-only callers (discovery agents) get a clean checkout of the default
 * branch with the latest remote state. The function clones on first use and
 * refreshes the GitHub App installation token on subsequent runs.
 *
 * Uses execFileSync (not execSync) so DB-sourced values like `defaultBranch`
 * cannot be interpreted as shell metacharacters. Token-bearing URLs are passed
 * as a single argv element so they never reach a shell or get expanded.
 */
export async function setupRepoForRead(opts: RepoSetupOptions): Promise<RepoSetupResult> {
  assertSafeBranch(opts.defaultBranch);
  const repoPath = path.join(REPO_ROOT, opts.repositoryId);

  if (!fs.existsSync(repoPath)) {
    const cloneUrl = await buildAuthenticatedCloneUrl(opts.repoUrl);
    log.info({ repositoryId: opts.repositoryId, repoPath }, "repo-setup: cloning repository");
    fs.mkdirSync(path.dirname(repoPath), { recursive: true });
    git(["clone", cloneUrl, repoPath]);
  } else {
    const freshUrl = await buildAuthenticatedCloneUrl(opts.repoUrl);
    git(["remote", "set-url", "origin", freshUrl], repoPath);
  }

  // Force-sync default branch to remote HEAD. Discovery is read-only so we are
  // safe to discard any stale local state.
  git(["fetch", "origin", opts.defaultBranch, "--depth=1"], repoPath);
  git(["checkout", opts.defaultBranch], repoPath);
  git(["reset", "--hard", `origin/${opts.defaultBranch}`], repoPath);

  const headSha = git(["rev-parse", "HEAD"], repoPath).trim();

  return { repoPath, defaultBranch: opts.defaultBranch, headSha };
}

function git(args: string[], cwd?: string): string {
  try {
    const result = execFileSync("git", args, {
      ...(cwd ? { cwd } : {}),
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return result;
  } catch (err) {
    // Strip the token from the error message in case git surfaced the URL.
    const message = err instanceof Error ? err.message : String(err);
    const sanitized = message.replace(/x-access-token:[^@\s]+@/g, "x-access-token:<redacted>@");
    throw new Error(`git ${args[0]} failed: ${sanitized}`);
  }
}

export async function buildAuthenticatedCloneUrl(repositoryUrl: string): Promise<string> {
  const appId = process.env["GITHUB_APP_ID"];
  const privateKeyB64 = process.env["GITHUB_APP_PRIVATE_KEY_B64"];
  const installationIdStr = process.env["GITHUB_INSTALLATION_ID"];

  if (!appId || !privateKeyB64 || !installationIdStr) {
    return repositoryUrl;
  }

  const baseUrl = repositoryUrl.replace(/https:\/\/[^@]+@/, "https://");
  if (!baseUrl.includes("github.com")) return repositoryUrl;

  try {
    const token = await getInstallationToken(appId, privateKeyB64, parseInt(installationIdStr, 10));
    return baseUrl.replace("https://", `https://x-access-token:${token}@`);
  } catch (err) {
    log.warn({ err: String(err) }, "repo-setup: failed to generate GitHub token — using original URL");
    return repositoryUrl;
  }
}
