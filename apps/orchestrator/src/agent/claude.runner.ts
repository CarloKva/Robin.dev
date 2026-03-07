import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";
import type { JobPayload, JobResult, ADWPPhase } from "@robin/shared-types";
import {
  AgentTimeoutError,
  AgentBlockedError,
  RepositoryAccessError,
  ClaudeNotFoundError,
  ClaudeExitError,
} from "../errors/job.errors";
import { getInstallationToken } from "../services/github.service";
import { log } from "../utils/logger";

const STDOUT_TAIL_CHARS = 10_000;

/** Callbacks fired during execution to emit structured events. */
export interface ClaudeRunnerHooks {
  onCommitPushed?: (commitSha: string, branch: string) => Promise<void>;
  onPhaseStarted?: (phase: ADWPPhase | string) => Promise<void>;
  onPhaseCompleted?: (phase: ADWPPhase | string, durationSeconds?: number) => Promise<void>;
  /** Decrypted env vars from the staging environment — injected into Claude's process env. */
  envVars?: Record<string, string>;
}

/**
 * ClaudeRunner encapsulates Claude Code headless execution.
 * It knows nothing about BullMQ — it takes a JobPayload and returns a JobResult.
 *
 * Execution flow:
 *   1. Write TASK.md to the repository root
 *   2. Spawn: claude --print --dangerously-skip-permissions
 *   3. Stream stdout/stderr, log every chunk
 *   4. Wait for exit or timeout
 *   5. Parse output → JobResult
 *   6. Clean up TASK.md
 *
 * Sprint 3: accepts optional hooks for structured event emission.
 */
export class ClaudeRunner {
  async run(payload: JobPayload, hooks: ClaudeRunnerHooks = {}): Promise<JobResult> {
    const startedAt = new Date().toISOString();

    log.info({ taskId: payload.taskId }, "ClaudeRunner starting");

    // Ensure repository path exists — auto-clone if url is available
    if (!fs.existsSync(payload.repositoryPath)) {
      if (!payload.repositoryUrl) {
        throw new RepositoryAccessError(
          `Repository path not found and no repositoryUrl provided: ${payload.repositoryPath}`
        );
      }
      // Inject a fresh GitHub App token before cloning to avoid stale/missing tokens
      const cloneUrl = await this.buildAuthenticatedCloneUrl(payload.repositoryUrl);
      log.info(
        { taskId: payload.taskId, repositoryPath: payload.repositoryPath },
        "Repository path not found — cloning"
      );
      await this.cloneRepository(cloneUrl, payload.repositoryPath);
    }

    // Write TASK.md
    const taskMdPath = path.join(payload.repositoryPath, "TASK.md");
    fs.writeFileSync(taskMdPath, this.buildTaskMd(payload), "utf-8");
    log.info({ taskId: payload.taskId, taskMdPath }, "TASK.md written");

    let stdoutBuffer = "";
    let stderrBuffer = "";

    // Write MCP config file if provided
    let mcpConfigPath: string | undefined;
    if (payload.mcpConfig) {
      mcpConfigPath = path.join(tmpdir(), `mcp-config-${payload.taskId}.json`);
      try {
        await fs.promises.writeFile(mcpConfigPath, JSON.stringify(payload.mcpConfig, null, 2), "utf-8");
        log.info({ taskId: payload.taskId, mcpConfigPath }, "MCP config written");
      } catch (err) {
        log.error({ taskId: payload.taskId, error: String(err) }, "Failed to write MCP config — proceeding without --mcp-config");
        mcpConfigPath = undefined;
      }
    }

    // Emit phase started — write phase
    await hooks.onPhaseStarted?.("write");

    try {
      const result = await this.spawnClaude(payload, hooks.envVars ?? {}, mcpConfigPath, (chunk) => {
        stdoutBuffer += chunk;
        log.info(
          { taskId: payload.taskId, chunk: chunk.slice(0, 200) },
          "Claude output"
        );

        // Detect commit SHA in output and emit commit event
        const commitMatch = chunk.match(/\b([0-9a-f]{40})\b/);
        const branchMatch = chunk.match(/(?:branch|feat|fix|chore)\/[\w/-]+/i);
        if (commitMatch?.[1] && hooks.onCommitPushed) {
          const sha = commitMatch[1];
          const branch = branchMatch?.[0] ?? payload.branch;
          // Fire-and-forget to avoid blocking stdout processing
          void hooks.onCommitPushed(sha, branch);
        }
      }, (chunk) => {
        stderrBuffer += chunk;
        log.warn({ taskId: payload.taskId, chunk }, "Claude stderr");
      });

      const completedAt = new Date().toISOString();
      const durationSeconds = Math.round(
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
      );

      const stdoutTail = stdoutBuffer.slice(-STDOUT_TAIL_CHARS);

      log.info(
        { taskId: payload.taskId, exitCode: result.exitCode, durationSeconds },
        "Claude process exited"
      );

      // Always log stderr if non-empty — critical for debugging silent failures
      if (stderrBuffer) {
        log.warn(
          { taskId: payload.taskId, stderr: stderrBuffer.slice(-2000) },
          "Claude stderr output"
        );
      }

      // Treat non-zero exit as a retryable failure — prevents false "completed" with 0 artifacts
      if (result.exitCode !== 0) {
        throw new ClaudeExitError(result.exitCode, stderrBuffer, "write");
      }

      // Emit phase completed — write phase
      await hooks.onPhaseCompleted?.("write", durationSeconds);

      // Check if agent wrote BLOCKED.md
      const blockedMdPath = path.join(payload.repositoryPath, "BLOCKED.md");
      if (fs.existsSync(blockedMdPath)) {
        const question = fs.readFileSync(blockedMdPath, "utf-8").trim();
        fs.unlinkSync(blockedMdPath);
        throw new AgentBlockedError(question);
      }

      // Emit proof phase
      await hooks.onPhaseStarted?.("proof");

      // Parse structured output
      const parsed = this.parseClaudeOutput(stdoutBuffer);

      await hooks.onPhaseCompleted?.("proof");

      return {
        status: parsed.prUrl ? "in_review" : "completed",
        ...(parsed.prUrl !== undefined && { prUrl: parsed.prUrl }),
        ...(parsed.prNumber !== undefined && { prNumber: parsed.prNumber }),
        ...(parsed.commitSha !== undefined && { commitSha: parsed.commitSha }),
        ...(parsed.commitBranch !== undefined && { commitBranch: parsed.commitBranch }),
        startedAt,
        completedAt,
        durationSeconds,
        stdoutTail,
      };
    } finally {
      // Always clean up TASK.md
      if (fs.existsSync(taskMdPath)) {
        fs.unlinkSync(taskMdPath);
      }
      // Clean up MCP config if it was written
      if (mcpConfigPath) {
        await fs.promises.rm(mcpConfigPath, { force: true });
      }
    }
  }

  private spawnClaude(
    payload: JobPayload,
    envVars: Record<string, string>,
    mcpConfigPath: string | undefined,
    onStdout: (chunk: string) => void,
    onStderr: (chunk: string) => void
  ): Promise<{ exitCode: number }> {
    return new Promise((resolve, reject) => {
      const claudePath = process.env["CLAUDE_BIN"] ?? "claude";
      const timeoutMs = payload.timeoutMinutes * 60 * 1000;

      const claudeArgs = [
        "--print",
        "--dangerously-skip-permissions",
        ...(mcpConfigPath ? ["--mcp-config", mcpConfigPath] : []),
        "Read the instructions in TASK.md and implement them.",
      ];

      let process_: ReturnType<typeof spawn>;
      try {
        process_ = spawn(
          claudePath,
          claudeArgs,
          {
            cwd: payload.repositoryPath,
            env: {
              ...process.env,
              ...envVars,
              ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"],
            },
            stdio: ["ignore", "pipe", "pipe"],
          }
        );
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new ClaudeNotFoundError("claude binary not found. Is Claude Code installed?"));
        } else {
          reject(err);
        }
        return;
      }

      const timer = setTimeout(() => {
        process_.kill("SIGTERM");
        reject(new AgentTimeoutError(`Claude Code timed out after ${payload.timeoutMinutes} minutes`));
      }, timeoutMs);

      process_.stdout?.on("data", (data: Buffer) => onStdout(data.toString()));
      process_.stderr?.on("data", (data: Buffer) => onStderr(data.toString()));

      process_.on("error", (err) => {
        clearTimeout(timer);
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new ClaudeNotFoundError("claude binary not found. Is Claude Code installed?"));
        } else {
          reject(err);
        }
      });

      process_.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1 });
      });
    });
  }

  private parseClaudeOutput(stdout: string): {
    prUrl?: string;
    prNumber?: number;
    commitSha?: string;
    commitBranch?: string;
  } {
    const result: { prUrl?: string; prNumber?: number; commitSha?: string; commitBranch?: string } = {};

    try {
      const lines = stdout.trim().split("\n");
      const lastLine = lines[lines.length - 1];
      if (lastLine?.startsWith("{")) {
        const parsed = JSON.parse(lastLine) as Record<string, unknown>;
        if (typeof parsed["pr_url"] === "string") result.prUrl = parsed["pr_url"];
        if (typeof parsed["pr_number"] === "number") result.prNumber = parsed["pr_number"];
        if (typeof parsed["commit_sha"] === "string") result.commitSha = parsed["commit_sha"];
        if (typeof parsed["branch"] === "string") result.commitBranch = parsed["branch"];
        return result;
      }
    } catch {
      // Fall through to regex parsing
    }

    // Fallback: regex scan for GitHub PR URL in stdout
    const prMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/);
    const commitMatch = stdout.match(/\b([0-9a-f]{40})\b/);

    if (prMatch?.[0]) result.prUrl = prMatch[0];
    if (prMatch?.[1]) result.prNumber = parseInt(prMatch[1], 10);
    if (commitMatch?.[1]) result.commitSha = commitMatch[1];

    return result;
  }

  /**
   * Returns a GitHub HTTPS clone URL with a fresh installation token injected.
   * Uses GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_B64, GITHUB_INSTALLATION_ID from env.
   * Falls back to the original URL if credentials are not available.
   */
  private async buildAuthenticatedCloneUrl(repositoryUrl: string): Promise<string> {
    const appId = process.env["GITHUB_APP_ID"];
    const privateKeyB64 = process.env["GITHUB_APP_PRIVATE_KEY_B64"];
    const installationIdStr = process.env["GITHUB_INSTALLATION_ID"];

    if (!appId || !privateKeyB64 || !installationIdStr) {
      log.warn({}, "GitHub App env vars not set — cloning without fresh token");
      return repositoryUrl;
    }

    // Strip any existing token so we can inject a fresh one
    const baseUrl = repositoryUrl.replace(/https:\/\/[^@]+@/, "https://");

    if (!baseUrl.includes("github.com")) {
      return repositoryUrl;
    }

    try {
      const token = await getInstallationToken(
        appId,
        privateKeyB64,
        parseInt(installationIdStr, 10)
      );
      const authenticated = baseUrl.replace("https://", `https://x-access-token:${token}@`);
      log.info({}, "Fresh GitHub App token injected for clone");
      return authenticated;
    } catch (err) {
      log.warn({ err: String(err) }, "Failed to generate GitHub token — cloning with original URL");
      return repositoryUrl;
    }
  }

  /** Clone a git repository to targetPath, creating parent directories as needed. */
  private async cloneRepository(repositoryUrl: string, targetPath: string): Promise<void> {
    const parentDir = path.dirname(targetPath);
    fs.mkdirSync(parentDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const git = spawn("git", ["clone", repositoryUrl, targetPath], { stdio: "pipe" });
      const stderr: string[] = [];
      git.stderr?.on("data", (d: Buffer) => stderr.push(d.toString()));
      git.on("close", (code) => {
        if (code === 0) {
          log.info({ repositoryUrl, targetPath }, "Repository cloned successfully");
          resolve();
        } else {
          reject(new RepositoryAccessError(
            `Failed to clone ${repositoryUrl}: exit code ${code} — ${stderr.join("").trim()}`
          ));
        }
      });
      git.on("error", (err) => reject(new RepositoryAccessError(
        `Failed to clone ${repositoryUrl}: ${err.message}`
      )));
    });
  }

  private buildTaskMd(payload: JobPayload): string {
    const baseBranch = payload.targetBranch
      ?? (payload.branch === `feat/${payload.taskId}` ? "main" : payload.branch);
    return `# Task: ${payload.taskTitle}

**Type:** ${payload.taskType}
**Priority:** ${payload.priority}
**Task ID:** ${payload.taskId}

## Description

${payload.taskDescription}

## Required Steps (ALL mandatory — do not skip any)

1. Sync with \`${baseBranch}\` and create a new branch from the latest upstream to avoid merge conflicts:
   \`\`\`bash
   git fetch origin
   git checkout -b feat/${payload.taskId} origin/${baseBranch}
   \`\`\`
2. Implement the task: create or edit files as needed
3. Run lint and type-check — **both must pass before committing** (see \`${payload.claudeMdPath}\` for exact commands):
   \`\`\`bash
   # example — use the commands defined in CLAUDE.md for this project
   npm run lint
   npx tsc --noEmit
   \`\`\`
   Fix all errors and warnings before continuing. Do not commit with failing checks.
4. Run \`git add -A && git commit -m "<descriptive message>"\`
5. Run \`git push origin feat/${payload.taskId}\`
6. Open a Pull Request from \`feat/${payload.taskId}\` to \`${baseBranch}\`
7. After opening the PR, verify CI status checks pass:
   \`\`\`bash
   gh pr checks <PR_URL> --watch
   \`\`\`
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   \`{"pr_url":"<url>","branch":"feat/${payload.taskId}"}\`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to \`BLOCKED.md\` in the repository root instead.

## Notes

- Follow the conventions in \`${payload.claudeMdPath}\` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
`;
  }
}
