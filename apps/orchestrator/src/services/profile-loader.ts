import * as fs from "fs";
import * as path from "path";
import { log } from "../utils/logger";

export type ProfileBundle = {
  id: string;
  rootPath: string;
  systemPrompt: string;
  allowedTools: string[];
  mcpConfigTemplate: { mcpServers: Record<string, unknown> };
  outputSchema: Record<string, unknown>;
};

const PROFILE_ROOT_OVERRIDE = process.env["MAINTENANCE_PROFILE_ROOT"];

/**
 * Resolve the on-disk root for a capability profile.
 *
 * `profile_path` is stored as a repository-relative path (e.g.
 * `apps/orchestrator/profiles/spec-discovery`). On a provisioned agent VPS the
 * orchestrator checkout lives at `/opt/robin/app`, but local development runs
 * out of the source tree. We resolve in this order:
 *
 * 1. `MAINTENANCE_PROFILE_ROOT` env override (testing/local dev).
 * 2. `/opt/robin/app/<profile_path>` — matches the production VPS layout.
 * 3. Repo root inferred from the running module (`__dirname/../../../..`).
 */
function resolveProfileRoot(profilePath: string): string {
  if (PROFILE_ROOT_OVERRIDE) {
    return path.join(PROFILE_ROOT_OVERRIDE, profilePath);
  }

  const vpsPath = path.join("/opt/robin/app", profilePath);
  if (fs.existsSync(vpsPath)) return vpsPath;

  // From apps/orchestrator/src/services up four levels lands at the repo root.
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  return path.join(repoRoot, profilePath);
}

export function loadProfileBundle(profileId: string, profilePath: string): ProfileBundle {
  const root = resolveProfileRoot(profilePath);

  const systemPromptPath = path.join(root, "system_prompt.md");
  const allowedToolsPath = path.join(root, "allowed_tools.json");
  const mcpTemplatePath = path.join(root, "mcp_config.template.json");
  const outputSchemaPath = path.join(root, "output_schema.json");

  for (const p of [systemPromptPath, allowedToolsPath, mcpTemplatePath, outputSchemaPath]) {
    if (!fs.existsSync(p)) {
      throw new Error(`profile-loader: missing required file ${p}`);
    }
  }

  const systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");
  const allowedToolsRaw = JSON.parse(fs.readFileSync(allowedToolsPath, "utf-8"));
  const mcpConfigTemplate = JSON.parse(fs.readFileSync(mcpTemplatePath, "utf-8"));
  const outputSchema = JSON.parse(fs.readFileSync(outputSchemaPath, "utf-8"));

  const allowedTools = Array.isArray(allowedToolsRaw?.allowedTools)
    ? (allowedToolsRaw.allowedTools as string[])
    : [];

  if (allowedTools.length === 0) {
    log.warn({ profileId, rootPath: root }, "profile-loader: allowedTools is empty");
  }

  return {
    id: profileId,
    rootPath: root,
    systemPrompt,
    allowedTools,
    mcpConfigTemplate: mcpConfigTemplate ?? { mcpServers: {} },
    outputSchema: outputSchema ?? {},
  };
}
