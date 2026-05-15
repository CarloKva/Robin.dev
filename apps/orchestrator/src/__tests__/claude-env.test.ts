import { describe, it, expect } from "vitest";
import { buildClaudeEnv } from "../workers/maintenance-agent.runner";

describe("buildClaudeEnv", () => {
  it("forwards ANTHROPIC_API_KEY and Anthropic/Claude-prefixed vars", () => {
    const env = buildClaudeEnv({
      ANTHROPIC_API_KEY: "sk-test",
      ANTHROPIC_BASE_URL: "https://example.com",
      CLAUDE_CODE_USE_BEDROCK: "1",
      PATH: "/usr/bin",
    });
    expect(env["ANTHROPIC_API_KEY"]).toBe("sk-test");
    expect(env["ANTHROPIC_BASE_URL"]).toBe("https://example.com");
    expect(env["CLAUDE_CODE_USE_BEDROCK"]).toBe("1");
    expect(env["PATH"]).toBe("/usr/bin");
  });

  it("filters out sensitive credentials and shared secrets", () => {
    const env = buildClaudeEnv({
      ANTHROPIC_API_KEY: "sk-test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
      SUPABASE_URL: "https://x.supabase.co",
      GITHUB_APP_PRIVATE_KEY_B64: "private-key-b64",
      GITHUB_INSTALLATION_ID: "123",
      REDIS_URL: "redis://localhost",
      DATABASE_URL: "postgres://...",
      AGENT_ID: "uuid",
      OPENAI_API_KEY: "should-not-leak",
    });
    expect(env["SUPABASE_SERVICE_ROLE_KEY"]).toBeUndefined();
    expect(env["SUPABASE_URL"]).toBeUndefined();
    expect(env["GITHUB_APP_PRIVATE_KEY_B64"]).toBeUndefined();
    expect(env["GITHUB_INSTALLATION_ID"]).toBeUndefined();
    expect(env["REDIS_URL"]).toBeUndefined();
    expect(env["DATABASE_URL"]).toBeUndefined();
    expect(env["AGENT_ID"]).toBeUndefined();
    expect(env["OPENAI_API_KEY"]).toBeUndefined();
  });

  it("always sets ANTHROPIC_API_KEY (empty string when missing)", () => {
    const env = buildClaudeEnv({});
    expect(env["ANTHROPIC_API_KEY"]).toBe("");
  });

  it("forwards HOME/PATH/LANG/TZ for the subprocess to work", () => {
    const env = buildClaudeEnv({
      HOME: "/home/agent",
      PATH: "/usr/bin",
      LANG: "en_US.UTF-8",
      TZ: "Europe/Rome",
      USER: "agent",
    });
    expect(env["HOME"]).toBe("/home/agent");
    expect(env["PATH"]).toBe("/usr/bin");
    expect(env["LANG"]).toBe("en_US.UTF-8");
    expect(env["TZ"]).toBe("Europe/Rome");
    expect(env["USER"]).toBe("agent");
  });

  it("ignores keys with undefined values", () => {
    const env = buildClaudeEnv({
      ANTHROPIC_API_KEY: "sk-test",
      ANTHROPIC_BASE_URL: undefined,
    });
    expect(env["ANTHROPIC_BASE_URL"]).toBeUndefined();
  });
});
