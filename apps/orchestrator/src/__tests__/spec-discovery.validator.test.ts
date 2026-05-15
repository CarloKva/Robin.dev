import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  isProtectedPath,
  validateSpecDiscoveryOutput,
} from "../services/spec-discovery.validator";

const PROTECTED = [".env*", "supabase/migrations/**", ".github/workflows/**"];

describe("isProtectedPath", () => {
  it("matches single-segment glob (.env*)", () => {
    expect(isProtectedPath(".env", PROTECTED)).toBe(true);
    expect(isProtectedPath(".env.local", PROTECTED)).toBe(true);
    expect(isProtectedPath("apps/web/.env.local", PROTECTED)).toBe(true);
  });

  it("matches recursive ** pattern", () => {
    expect(isProtectedPath("supabase/migrations/0020.sql", PROTECTED)).toBe(true);
    expect(isProtectedPath(".github/workflows/deploy.yml", PROTECTED)).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(isProtectedPath("apps/web/lib/foo.ts", PROTECTED)).toBe(false);
    expect(isProtectedPath("docs/spec.md", PROTECTED)).toBe(false);
  });

  it("handles ./ and leading slash normalization", () => {
    expect(isProtectedPath("./.env", PROTECTED)).toBe(true);
    expect(isProtectedPath("/supabase/migrations/0020.sql", PROTECTED)).toBe(true);
  });
});

describe("validateSpecDiscoveryOutput", () => {
  let tmpDir: string;
  const specPath = "docs/spec.md";
  const specContent = [
    "# Spec",
    "",
    "Users must be able to log in with email and password.",
    "Reports should be exportable as CSV.",
    "",
  ].join("\n");

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "robin-spec-validator-"));
    fs.mkdirSync(path.join(tmpDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, specPath), specContent, "utf-8");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const opts = () => ({
    repoPath: tmpDir,
    specPaths: [specPath],
    protectedPaths: PROTECTED,
  });

  it("throws when top-level shape is wrong", () => {
    expect(() =>
      validateSpecDiscoveryOutput({ findings: "nope" } as never, opts())
    ).toThrow();
  });

  it("accepts a well-formed finding", () => {
    const result = validateSpecDiscoveryOutput(
      {
        findings: [
          {
            requirement_text: "Users must be able to log in with email and password",
            requirement_source_path: specPath,
            requirement_source_line: 3,
            status: "missing",
            evidence_paths: ["apps/web/lib/auth.ts"],
            confidence: 0.9,
          },
        ],
        summary: "audit complete",
        tokens_used: 1000,
        cost_usd: 0.02,
      },
      opts()
    );
    expect(result.output.findings.length).toBe(1);
    expect(result.dropped.length).toBe(0);
  });

  it("drops findings below the confidence floor", () => {
    const result = validateSpecDiscoveryOutput(
      {
        findings: [
          {
            requirement_text: "Users must be able to log in with email and password",
            requirement_source_path: specPath,
            requirement_source_line: 3,
            status: "missing",
            evidence_paths: [],
            confidence: 0.3,
          },
        ],
        summary: "",
        tokens_used: 0,
        cost_usd: 0,
      },
      opts()
    );
    expect(result.output.findings.length).toBe(0);
    expect(result.dropped[0]?.reason).toBe("confidence_below_floor");
  });

  it("drops evidence paths under protected_paths", () => {
    const result = validateSpecDiscoveryOutput(
      {
        findings: [
          {
            requirement_text: "Users must be able to log in",
            requirement_source_path: specPath,
            requirement_source_line: 3,
            status: "missing",
            evidence_paths: ["supabase/migrations/0020_login.sql"],
            confidence: 0.9,
          },
        ],
        summary: "",
        tokens_used: 0,
        cost_usd: 0,
      },
      opts()
    );
    expect(result.output.findings.length).toBe(0);
    expect(result.dropped[0]?.reason).toBe("evidence_path_protected");
  });

  it("drops findings whose source path is not in spec_paths", () => {
    const result = validateSpecDiscoveryOutput(
      {
        findings: [
          {
            requirement_text: "x",
            requirement_source_path: "README.md",
            requirement_source_line: 1,
            status: "missing",
            evidence_paths: [],
            confidence: 0.9,
          },
        ],
        summary: "",
        tokens_used: 0,
        cost_usd: 0,
      },
      opts()
    );
    expect(result.output.findings.length).toBe(0);
    expect(result.dropped[0]?.reason).toBe("source_path_not_in_spec_paths");
  });

  it("drops findings whose source line does not anchor the requirement text", () => {
    const result = validateSpecDiscoveryOutput(
      {
        findings: [
          {
            requirement_text: "Two factor authentication via SMS",
            requirement_source_path: specPath,
            requirement_source_line: 4,
            status: "missing",
            evidence_paths: [],
            confidence: 0.9,
          },
        ],
        summary: "",
        tokens_used: 0,
        cost_usd: 0,
      },
      opts()
    );
    expect(result.output.findings.length).toBe(0);
    expect(result.dropped[0]?.reason).toBe("source_line_does_not_anchor_requirement");
  });

  it("caps findings at max and keeps highest-confidence ones", () => {
    const findings = Array.from({ length: 5 }, (_, i) => ({
      requirement_text: "Users must be able to log in with email and password",
      requirement_source_path: specPath,
      requirement_source_line: 3,
      status: "missing",
      evidence_paths: [],
      confidence: 0.5 + i * 0.1,
    }));
    const result = validateSpecDiscoveryOutput(
      {
        findings,
        summary: "",
        tokens_used: 0,
        cost_usd: 0,
      },
      { ...opts(), maxFindings: 2 }
    );
    expect(result.output.findings.length).toBe(2);
    expect(result.output.findings[0]?.confidence).toBe(0.9);
    expect(result.output.findings[1]?.confidence).toBe(0.8);
    expect(
      result.dropped.filter((d) => d.reason === "max_findings_cap_exceeded").length
    ).toBe(3);
  });
});
