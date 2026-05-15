import { execSync } from "child_process";
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

/**
 * Prepare a working tree for a maintenance/discovery run.
 *
 * Read-only callers (discovery agents) get a clean checkout of the default
 * branch with the latest remote state. The function clones on first use and
 * refreshes the GitHub App installation token on subsequent runs.
 */
export async function setupRepoForRead(opts: RepoSetupOptions): Promise<RepoSetupResult> {
  const repoPath = path.join(REPO_ROOT, opts.repositoryId);

  if (!fs.existsSync(repoPath)) {
    const cloneUrl = await buildAuthenticatedCloneUrl(opts.repoUrl);
    log.info({ repositoryId: opts.repositoryId, repoPath }, "repo-setup: cloning repository");
    fs.mkdirSync(path.dirname(repoPath), { recursive: true });
    execSync(`git clone ${cloneUrl} ${repoPath}`, { stdio: "pipe" });
  } else {
    const freshUrl = await buildAuthenticatedCloneUrl(opts.repoUrl);
    execSync(`git remote set-url origin ${freshUrl}`, { cwd: repoPath, stdio: "pipe" });
  }

  // Force-sync default branch to remote HEAD. Discovery is read-only so we are
  // safe to discard any stale local state.
  execSync(`git fetch origin ${opts.defaultBranch} --depth=1`, { cwd: repoPath, stdio: "pipe" });
  execSync(`git checkout ${opts.defaultBranch}`, { cwd: repoPath, stdio: "pipe" });
  execSync(`git reset --hard origin/${opts.defaultBranch}`, { cwd: repoPath, stdio: "pipe" });

  const headSha = execSync("git rev-parse HEAD", {
    cwd: repoPath,
    encoding: "utf-8",
  }).trim();

  return { repoPath, defaultBranch: opts.defaultBranch, headSha };
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
