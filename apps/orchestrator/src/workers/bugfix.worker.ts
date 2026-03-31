import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { BugfixJobData, BugfixResult } from "@robin/shared-types";
import * as path from "path";
import { execSync } from "child_process";
import * as fs from "fs";
import { getRedisConnection } from "../db/redis.client";
import { taskRepository } from "../repositories/task.repository";
import { agentRepository } from "../repositories/agent.repository";
import { eventService } from "../events/event.service";
import { notificationService } from "../services/notification.service";
import { getInstallationToken } from "../services/github.service";
import { JobError } from "../errors/job.errors";
import { log } from "../utils/logger";

const AGENT_ID = process.env["AGENT_ID"] ?? "b0000000-0000-0000-0000-000000000001";

const BUGFIX_QUEUE_NAME = "bugfix-pipeline";
const PLUGIN_PATH = path.resolve(__dirname, "../../plugins/bugfix-pipeline");

/**
 * Bugfix pipeline worker — uses the Claude Agent SDK to run an autonomous
 * bugfix agent with structured debugging skills, test-driven fix workflow,
 * and safety hooks.
 *
 * Runs on agent VPS only (IS_CONTROL_PLANE === false).
 * Concurrency MUST be 1 — the agent mutates git state in the working directory.
 */
async function processBugfixJob(job: Job<BugfixJobData>): Promise<BugfixResult> {
  const {
    taskId,
    workspaceId,
    agentId: jobAgentId,
    repoUrl,
    repoPath,
    repoBranch,
    bugDescription,
    issueNumber,
    issueUrl,
    maxTurns = 40,
    model = "claude-sonnet-4-6",
  } = job.data;

  log.info({ jobId: job.id, taskId, phase: "start" }, "Processing bugfix job");

  // Routing safety check (same pattern as task.worker.ts)
  if (jobAgentId && jobAgentId !== AGENT_ID) {
    log.warn(
      { jobId: job.id, taskId, jobAgentId, AGENT_ID },
      "Bugfix job agent mismatch — resetting task to pending"
    );
    await taskRepository.resetToUnqueued(taskId);
    return {
      status: "failed",
      summary: "Agent routing mismatch — task reset for correct agent",
      filesChanged: [],
      testsRun: false,
      testsPassed: false,
      turnCount: 0,
    };
  }

  // 1. Mark task in_progress + agent busy + create iteration
  await taskRepository.updateStatus(taskId, "in_progress", { actorId: AGENT_ID });
  await agentRepository.setStatus(AGENT_ID, "busy", taskId);
  const iterationNumber = await taskRepository.createIteration({
    taskId,
    workspaceId,
    trigger: "initial",
  });
  await eventService.phaseStarted(taskId, workspaceId, AGENT_ID, "analysis");

  // 2. Ensure repo is cloned and on correct branch
  await ensureRepo(repoUrl, repoPath, repoBranch, taskId);

  // 3. Build the prompt
  const prompt = buildBugfixPrompt({
    bugDescription,
    repoBranch,
    ...(issueNumber !== undefined && { issueNumber }),
    ...(issueUrl !== undefined && { issueUrl }),
  });

  // 4. Run the Claude Agent SDK
  let turnCount = 0;
  const assistantMessages: string[] = [];

  try {
    const agentQuery = query({
      prompt,
      options: {
        cwd: repoPath,
        model,
        maxTurns,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
        settingSources: ["project"],
        plugins: [{ type: "local", path: PLUGIN_PATH }],
        env: {
          ...process.env as Record<string, string>,
          ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"] ?? "",
        },
      },
    });

    let resultMessage: { result: string; total_cost_usd: number; num_turns: number; duration_ms: number; usage: { input_tokens: number; output_tokens: number } | null } | undefined;

    for await (const message of agentQuery) {
      if (message.type === "assistant") {
        turnCount++;
        const content = (message as { message?: { content?: Array<{ text?: string }> } }).message?.content;
        if (content) {
          for (const block of content) {
            if (block.text) {
              assistantMessages.push(block.text);
            }
          }
        }

        // Report progress every 5 turns
        if (turnCount % 5 === 0) {
          await job.updateProgress({
            turnCount,
            lastMessage: assistantMessages[assistantMessages.length - 1]?.slice(0, 200),
          });
        }
      }

      if (message.type === "result") {
        const msg = message as unknown as Record<string, unknown>;
        const usage = (msg["usage"] as { input_tokens: number; output_tokens: number } | undefined) ?? null;
        resultMessage = {
          result: typeof msg["result"] === "string" ? msg["result"] : JSON.stringify(msg["result"]),
          total_cost_usd: (msg["total_cost_usd"] as number) ?? 0,
          num_turns: (msg["num_turns"] as number) ?? turnCount,
          duration_ms: (msg["duration_ms"] as number) ?? 0,
          usage,
        };
      }
    }

    await eventService.phaseCompleted(taskId, workspaceId, AGENT_ID, "analysis");

    // 5. Gather results
    const filesChanged = getChangedFiles(repoPath);
    const branchName = getCurrentBranch(repoPath);
    const summary = resultMessage?.result
      ?? assistantMessages[assistantMessages.length - 1]
      ?? "No output";

    const testsRun = assistantMessages.some(m =>
      m.includes("vitest") || m.includes("npm run test") || m.includes("test suite")
    );
    const testsPassed = assistantMessages.some(m =>
      m.includes("Tests passed") || /\d+ pass/.test(m) || m.includes("All tests passed")
    );

    // Detect escalation (agent gave up)
    const isEscalated = assistantMessages.some(m =>
      m.includes("STOP") ||
      m.includes("requires architectural") ||
      m.includes("stuck after 3 attempts") ||
      m.includes("cannot fix autonomously")
    );

    // Parse PR URL from output
    const prMatch = summary.match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/);
    const prUrl = prMatch?.[0];
    const prNumber = prMatch?.[1] ? parseInt(prMatch[1], 10) : undefined;

    const tokenUsage = resultMessage?.usage != null
      ? { input: resultMessage.usage.input_tokens, output: resultMessage.usage.output_tokens }
      : undefined;

    const result: BugfixResult = {
      status: isEscalated ? "escalated" : filesChanged.length > 0 ? "success" : "failed",
      summary: summary.slice(0, 5000),
      filesChanged,
      testsRun,
      testsPassed,
      turnCount: resultMessage?.num_turns ?? turnCount,
      ...(branchName !== repoBranch && { branchName }),
      ...(prUrl !== undefined && { prUrl }),
      ...(prNumber !== undefined && { prNumber }),
      ...(resultMessage?.total_cost_usd !== undefined && { costUsd: resultMessage.total_cost_usd }),
      ...(tokenUsage !== undefined && { tokenUsage }),
      ...(resultMessage?.duration_ms !== undefined && { durationMs: resultMessage.duration_ms }),
    };

    // 6. Persist result following the task.worker.ts pattern
    if (result.status === "success" && result.prUrl) {
      await taskRepository.addArtifact(taskId, workspaceId, {
        type: "pr",
        url: result.prUrl,
        title: `Bugfix PR for ${taskId}`,
      });
      await eventService.prOpened(taskId, workspaceId, AGENT_ID, result.prUrl, result.prNumber);
      await taskRepository.updateStatus(taskId, "in_review", { actorId: AGENT_ID });
      await taskRepository.updateIteration(taskId, iterationNumber, {
        status: "completed",
        prUrl: result.prUrl,
      });
      await notificationService.notifyTaskReady({
        id: taskId,
        title: `Bugfix: ${issueNumber ? `#${issueNumber}` : taskId}`,
        workspaceId,
        prUrl: result.prUrl,
      });
    } else if (result.status === "escalated") {
      // Map escalated → failed with detailed note (per founder decision: no new status)
      await eventService.agentBlocked(taskId, workspaceId, AGENT_ID, result.summary);
      await taskRepository.updateStatus(taskId, "failed", {
        actorId: AGENT_ID,
        note: `ESCALATED: ${result.summary.slice(0, 500)}`,
      });
      await taskRepository.updateIteration(taskId, iterationNumber, { status: "failed" });
      await eventService.taskFailed(taskId, workspaceId, AGENT_ID, "BUGFIX_ESCALATED", result.summary.slice(0, 500));
    } else {
      // Failed — no changes produced
      await taskRepository.updateStatus(taskId, "failed", {
        actorId: AGENT_ID,
        note: `Bugfix failed: ${result.summary.slice(0, 500)}`,
      });
      await taskRepository.updateIteration(taskId, iterationNumber, { status: "failed" });
      await eventService.taskFailed(taskId, workspaceId, AGENT_ID, "BUGFIX_FAILED", result.summary.slice(0, 500));
    }

    // 7. Mark agent idle
    await agentRepository.setStatus(AGENT_ID, "idle", null);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ taskId, error: message }, "Bugfix agent error");

    await agentRepository.setStatus(AGENT_ID, "error", null);

    return {
      status: "failed",
      summary: `Agent error: ${message}`,
      filesChanged: [],
      testsRun: false,
      testsPassed: false,
      turnCount,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildBugfixPrompt(opts: {
  bugDescription: string;
  issueNumber?: string;
  issueUrl?: string;
  repoBranch: string;
}): string {
  const parts: string[] = [];

  parts.push("# Bugfix Task\n");
  parts.push(`## Bug Description\n${opts.bugDescription}\n`);

  if (opts.issueNumber) {
    parts.push(`## Issue Reference\nIssue #${opts.issueNumber}`);
    if (opts.issueUrl) parts.push(` — ${opts.issueUrl}`);
    parts.push("\n");
  }

  parts.push(`## Base Branch\n\`${opts.repoBranch}\`\n`);

  parts.push(`## Instructions
1. First read CLAUDE.md / README.md if they exist to understand project conventions
2. Read package.json to understand the stack, scripts, and dependencies
3. Use the systematic-debugging skill to investigate the root cause
4. Use the test-driven-fix skill to write a failing test, then implement the fix
5. Run the full test suite and build to verify no regressions
6. Use the safe-commit skill to create a branch, commit, and push
7. If the project has the GitHub CLI (gh) available, create a PR targeting \`${opts.repoBranch}\`

## Branch Naming
Use: \`fix/${opts.issueNumber ? `issue-${opts.issueNumber}` : "bugfix"}-<short-description>\`

## Commit Message Format
\`\`\`
fix: <concise description>

Root cause: <why the bug happened>
Fix: <what the change does>
${opts.issueNumber ? `\nCloses #${opts.issueNumber}` : ""}
\`\`\`

## CRITICAL RULES
- Make the SMALLEST possible change to fix the bug
- Do NOT refactor unrelated code
- Do NOT install new dependencies unless absolutely necessary
- Do NOT modify CI/CD, deployment configs, or environment files
- Do NOT run database migrations
- If you cannot fix the bug after thorough investigation, STOP and provide a detailed report of:
  - What you investigated
  - What you believe the root cause is
  - Why you cannot fix it autonomously
  - Recommended next steps for a human developer
`);

  return parts.join("\n");
}

/**
 * Ensure repository is cloned and on the correct base branch.
 * Follows the same pattern as ClaudeRunner for repo setup + token refresh.
 */
async function ensureRepo(
  repoUrl: string,
  repoPath: string,
  repoBranch: string,
  taskId: string
): Promise<void> {
  if (!fs.existsSync(repoPath)) {
    const cloneUrl = await buildAuthenticatedCloneUrl(repoUrl);
    log.info({ taskId, repoPath }, "Bugfix: cloning repository");
    fs.mkdirSync(path.dirname(repoPath), { recursive: true });
    execSync(`git clone ${cloneUrl} ${repoPath}`, { stdio: "pipe" });
  } else {
    // Refresh token on existing clone
    const freshUrl = await buildAuthenticatedCloneUrl(repoUrl);
    execSync(`git remote set-url origin ${freshUrl}`, { cwd: repoPath, stdio: "pipe" });
    log.info({ taskId }, "Bugfix: remote URL refreshed with fresh token");
  }

  // Checkout base branch and pull latest
  execSync(`git checkout ${repoBranch} && git pull origin ${repoBranch}`, {
    cwd: repoPath,
    stdio: "pipe",
  });
}

async function buildAuthenticatedCloneUrl(repositoryUrl: string): Promise<string> {
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
    log.warn({ err: String(err) }, "Bugfix: failed to generate GitHub token — using original URL");
    return repositoryUrl;
  }
}

function getChangedFiles(repoPath: string): string[] {
  try {
    const output = execSync(
      "git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only",
      { cwd: repoPath, encoding: "utf-8" }
    );
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getCurrentBranch(repoPath: string): string {
  try {
    return execSync("git branch --show-current", {
      cwd: repoPath,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
}

// ─── Worker factory ─────────────────────────────────────────────────────────

export function createBugfixWorker(): Worker<BugfixJobData, BugfixResult> {
  const worker = new Worker<BugfixJobData, BugfixResult>(
    BUGFIX_QUEUE_NAME,
    processBugfixJob,
    {
      connection: getRedisConnection(),
      concurrency: 1, // MUST be 1 — agent mutates git state
      stalledInterval: 60_000, // bugfix jobs run longer than regular tasks
      maxStalledCount: 1,
      removeOnComplete: { count: 0 },
      removeOnFail: { count: 100 },
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, taskId: job.data.taskId }, "Bugfix job completed");
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;

    const { taskId, workspaceId } = job.data;
    const errorCode = err instanceof JobError ? err.code : "BUGFIX_ERROR";

    log.error(
      { jobId: job.id, taskId, errorCode, attempt: job.attemptsMade, message: err.message },
      "Bugfix job failed"
    );

    // On final attempt: persist failure
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinalAttempt) {
      try {
        await taskRepository.updateStatus(taskId, "failed", {
          actorId: AGENT_ID,
          note: `${errorCode}: ${err.message}`,
        });
        await eventService.taskFailed(taskId, workspaceId, AGENT_ID, errorCode, err.message);
        await taskRepository.markRunningIterationFailed(taskId);
      } catch (persistErr) {
        log.error(
          { taskId, error: String(persistErr) },
          "Failed to persist bugfix job failure to Supabase"
        );
      }

      await agentRepository.setStatus(AGENT_ID, "error", null);
    }
  });

  worker.on("stalled", async (jobId) => {
    log.warn({ jobId }, "Bugfix job stalled");
    await taskRepository.resetToUnqueued(jobId).catch((err) => {
      log.warn({ jobId, error: String(err) }, "Failed to reset queued_at on bugfix stall");
    });
  });

  worker.on("error", (err) => {
    log.error({ error: err.message }, "Bugfix worker error");
  });

  return worker;
}

export { BUGFIX_QUEUE_NAME };
