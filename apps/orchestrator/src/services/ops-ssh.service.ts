/**
 * SSH diagnostics service for the Ops Diagnostics Panel.
 * Connects to each agent VPS and collects system metrics in parallel.
 * Failed/unreachable VPS are reported with sshReachable=false, never thrown.
 */

import * as os from "os";
import * as path from "path";
import type { VpsDiagnostics } from "@robin/shared-types";

const DEFAULT_SSH_KEY = path.join(os.homedir(), ".ssh", "robindev_provisioning");

function getSshKeyPath(): string {
  const envPath = process.env["SSH_PRIVATE_KEY_PATH"];
  if (!envPath) return DEFAULT_SSH_KEY;
  if (envPath.startsWith("~/")) {
    return path.join(os.homedir(), envPath.slice(2));
  }
  return envPath;
}

async function collectSingleVps(
  workspaceSlug: string,
  vpsIp: string
): Promise<VpsDiagnostics> {
  // Dynamic import: node-ssh only installed on orchestrator, not needed at module-load time
  // ASSUMPTION: node-ssh@13 exports NodeSSH as default export
  const { NodeSSH } = await import("node-ssh");
  const ssh = new NodeSSH();

  // Sanitize slug for safe embedding in bash script
  const safeSlug = workspaceSlug.replace(/[^a-z0-9-]/gi, "");
  const serviceName = `robin-orchestrator-${safeSlug}`;

  const script = [
    `echo "SERVICE_STATUS=$(systemctl is-active ${serviceName} 2>/dev/null || echo unknown)"`,
    `echo "REDIS_PING=$(redis-cli ping 2>/dev/null | tr -d '\\r' || echo FAIL)"`,
    `echo "DISK_USED=$(df / --output=pcent 2>/dev/null | tail -1 | tr -d ' %' || echo 0)"`,
    `echo "INODE_USED=$(df -i / --output=pcent 2>/dev/null | tail -1 | tr -d ' %' || echo 0)"`,
    `echo "MEM_USED=$(free 2>/dev/null | awk '/Mem/ {printf "%.0f", $3/$2*100}' || echo 0)"`,
    `echo "BULL_ACTIVE=$(redis-cli llen bull:tasks:active 2>/dev/null | tr -d '\\r' || echo 0)"`,
    `echo "BULL_PRIORITY=$(redis-cli zcard bull:tasks:prioritized 2>/dev/null | tr -d '\\r' || echo 0)"`,
    `echo "===LOGS==="`,
    `journalctl -u ${serviceName} -n 15 --no-pager 2>/dev/null | tail -15`,
  ].join("\n");

  try {
    await ssh.connect({
      host: vpsIp,
      username: "root",
      privateKeyPath: getSshKeyPath(),
      readyTimeout: 12_000,
    });

    const { stdout } = await ssh.execCommand(script);

    // Parse KEY=VALUE section and logs section
    const logSepIdx = stdout.indexOf("===LOGS===");
    const metricsSection = logSepIdx >= 0 ? stdout.slice(0, logSepIdx) : stdout;
    const logsSection =
      logSepIdx >= 0
        ? stdout.slice(logSepIdx + "===LOGS===\n".length).trim()
        : "";

    const values: Record<string, string> = {};
    for (const line of metricsSection.split("\n")) {
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0) {
        values[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
      }
    }

    return {
      slug: workspaceSlug,
      vpsIp,
      sshReachable: true,
      serviceStatus: values["SERVICE_STATUS"] ?? "unknown",
      redisOk: (values["REDIS_PING"] ?? "").toUpperCase() === "PONG",
      memUsedPct: parseInt(values["MEM_USED"] ?? "0", 10) || 0,
      diskUsedPct: values["DISK_USED"] ?? "0",
      inodeUsedPct: values["INODE_USED"] ?? "0",
      bullActiveJobs: parseInt(values["BULL_ACTIVE"] ?? "0", 10) || 0,
      bullPriorityJobs: parseInt(values["BULL_PRIORITY"] ?? "0", 10) || 0,
      ...(logsSection ? { lastLogLines: logsSection } : {}),
    };
  } catch (err) {
    return {
      slug: workspaceSlug,
      vpsIp,
      sshReachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      ssh.dispose();
    } catch {
      // ignore dispose errors
    }
  }
}

/**
 * Collect diagnostics from all agent VPS in parallel.
 * Never throws — failed VPS are included with sshReachable=false.
 */
export async function collectAllVpsDiagnostics(
  agents: Array<{ workspaceSlug: string; vpsIp: string }>
): Promise<VpsDiagnostics[]> {
  if (agents.length === 0) return [];

  const results = await Promise.allSettled(
    agents.map((a) => collectSingleVps(a.workspaceSlug, a.vpsIp))
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const agent = agents[i]!;
    return {
      slug: agent.workspaceSlug,
      vpsIp: agent.vpsIp,
      sshReachable: false,
      error:
        r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

/**
 * Execute a single SSH command on a VPS (for ops-execute actions).
 * Returns { success, output } — never throws.
 */
export async function sshExec(
  vpsIp: string,
  command: string
): Promise<{ success: boolean; output: string }> {
  const { NodeSSH } = await import("node-ssh");
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: vpsIp,
      username: "root",
      privateKeyPath: getSshKeyPath(),
      readyTimeout: 12_000,
    });
    const { stdout, stderr, code } = await ssh.execCommand(command);
    return {
      success: code === 0,
      output: stdout || stderr || "(no output)",
    };
  } catch (err) {
    return {
      success: false,
      output: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      ssh.dispose();
    } catch {
      // ignore
    }
  }
}
