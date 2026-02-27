import { execSync } from "child_process";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30s
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Detects the installed Claude Code CLI version.
 * Returns null if not installed or version cannot be determined.
 */
function detectClaudeVersion(): string | null {
  try {
    const output = execSync("claude --version 2>/dev/null", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    // Output is typically "1.x.x" or "@anthropic-ai/claude-code@1.x.x"
    return output.split(/\s+/).pop() ?? output;
  } catch {
    return null;
  }
}

/**
 * HeartbeatService — updates the agent registry row every 30 seconds.
 *
 * Updates: agents.last_seen_at, agents.orchestrator_version, agents.claude_code_version
 *
 * This is what the /agents page uses to determine if an agent is online.
 * An agent is considered offline if last_seen_at is > 2 minutes old.
 */
export class HeartbeatService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly agentId: string;
  private readonly orchestratorVersion: string;
  private claudeVersion: string | null = null;

  constructor(agentId: string, orchestratorVersion: string) {
    this.agentId = agentId;
    this.orchestratorVersion = orchestratorVersion;
  }

  start(): void {
    if (this.timer) return;

    // Detect claude version once at startup
    this.claudeVersion = detectClaudeVersion();
    if (this.claudeVersion) {
      log.info({ claudeVersion: this.claudeVersion }, "Claude Code CLI detected");
    } else {
      log.warn({}, "Claude Code CLI version could not be detected");
    }

    // Fire immediately on start, then on interval
    void this.beat();
    this.timer = setInterval(() => void this.beat(), HEARTBEAT_INTERVAL_MS);
    log.info({ agentId: this.agentId, intervalMs: HEARTBEAT_INTERVAL_MS }, "HeartbeatService started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Mark offline immediately on graceful shutdown
    void this.markOffline();
    log.info({ agentId: this.agentId }, "HeartbeatService stopped");
  }

  private async beat(): Promise<void> {
    const db = getSupabaseClient();
    const now = new Date().toISOString();

    const { error } = await db
      .from("agents")
      .update({
        last_seen_at: now,
        orchestrator_version: this.orchestratorVersion,
        ...(this.claudeVersion !== null && { claude_code_version: this.claudeVersion }),
        updated_at: now,
      })
      .eq("id", this.agentId);

    if (error) {
      log.warn({ agentId: this.agentId, error: error.message }, "HeartbeatService.beat failed");
    }
  }

  private async markOffline(): Promise<void> {
    const db = getSupabaseClient();

    const { error } = await db
      .from("agent_status")
      .update({ status: "offline", updated_at: new Date().toISOString() })
      .eq("agent_id", this.agentId);

    if (error) {
      log.warn({ agentId: this.agentId, error: error.message }, "HeartbeatService.markOffline failed");
    }
  }

  /** Returns true if an agent's last_seen_at timestamp is fresh (< 2 min ago). */
  static isOnline(lastSeenAt: string | null): boolean {
    if (!lastSeenAt) return false;
    return Date.now() - new Date(lastSeenAt).getTime() < STALE_THRESHOLD_MS;
  }
}
