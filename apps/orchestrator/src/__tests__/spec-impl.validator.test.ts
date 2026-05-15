import { describe, it, expect } from "vitest";
import {
  validateSpecImplPlan,
  validateSpecImplResult,
} from "../services/spec-impl.validator";

const PROTECTED = [".env*", "supabase/migrations/**", ".github/workflows/**"];

describe("validateSpecImplPlan", () => {
  const base = {
    phase: "plan",
    file_allowlist: ["apps/web/lib/x.ts", "apps/web/lib/__tests__/x.test.ts"],
    test_strategy: "Unit test asserting Y",
    summary_per_file: [{ path: "apps/web/lib/x.ts", change: "Add function Y" }],
    needs_dependency_change: false,
    tokens_used: 100,
    cost_usd: 0.01,
  };

  it("accepts a well-formed plan", () => {
    const plan = validateSpecImplPlan(base, { protectedPaths: PROTECTED });
    expect(plan.phase).toBe("plan");
    expect(plan.file_allowlist).toHaveLength(2);
  });

  it("rejects when phase !== plan", () => {
    expect(() => validateSpecImplPlan({ ...base, phase: "impl" }, { protectedPaths: PROTECTED })).toThrow();
  });

  it("rejects an empty file_allowlist", () => {
    expect(() =>
      validateSpecImplPlan({ ...base, file_allowlist: [] }, { protectedPaths: PROTECTED })
    ).toThrow(/empty/);
  });

  it("rejects allowlist entries hitting protected_paths", () => {
    expect(() =>
      validateSpecImplPlan(
        { ...base, file_allowlist: [".env"] },
        { protectedPaths: PROTECTED }
      )
    ).toThrow(/protected/);
  });

  it("normalizes ./ and leading slashes in allowlist", () => {
    const plan = validateSpecImplPlan(
      {
        ...base,
        file_allowlist: ["./apps/web/lib/x.ts", "/apps/web/lib/__tests__/x.test.ts"],
      },
      { protectedPaths: PROTECTED }
    );
    expect(plan.file_allowlist).toContain("apps/web/lib/x.ts");
    expect(plan.file_allowlist).toContain("apps/web/lib/__tests__/x.test.ts");
  });

  it("caps allowlist at maxAllowlistSize", () => {
    const big = Array.from({ length: 50 }, (_, i) => `apps/web/lib/file${i}.ts`);
    expect(() =>
      validateSpecImplPlan(
        { ...base, file_allowlist: big },
        { protectedPaths: PROTECTED, maxAllowlistSize: 30 }
      )
    ).toThrow(/exceeds/);
  });

  it("filters summary_per_file entries not in the allowlist", () => {
    const plan = validateSpecImplPlan(
      {
        ...base,
        summary_per_file: [
          { path: "apps/web/lib/x.ts", change: "add" },
          { path: "apps/web/lib/y.ts", change: "noop" },
        ],
      },
      { protectedPaths: PROTECTED }
    );
    expect(plan.summary_per_file).toHaveLength(1);
    expect(plan.summary_per_file[0]?.path).toBe("apps/web/lib/x.ts");
  });

  it("captures needs_decomposition when set", () => {
    const plan = validateSpecImplPlan(
      { ...base, needs_decomposition: true, decomposition_reason: "too big" },
      { protectedPaths: PROTECTED }
    );
    expect(plan.needs_decomposition).toBe(true);
    expect(plan.decomposition_reason).toBe("too big");
  });
});

describe("validateSpecImplResult", () => {
  const allowlist = ["apps/web/lib/x.ts", "apps/web/lib/__tests__/x.test.ts"];
  const opts = {
    protectedPaths: PROTECTED,
    allowlist,
    expectedBranch: "feat/spec-abc12345-add-login",
  };

  it("accepts a well-formed success result", () => {
    const out = validateSpecImplResult(
      {
        phase: "impl",
        pr_url: "https://github.com/x/y/pull/42",
        branch: "feat/spec-abc12345-add-login",
        files_changed: ["apps/web/lib/x.ts", "apps/web/lib/__tests__/x.test.ts"],
        tests_added: ["apps/web/lib/__tests__/x.test.ts"],
        tests_run: ["x.test.ts"],
        tokens_used: 5000,
        cost_usd: 0.05,
      },
      opts
    );
    expect(out.result.outcome).toBe("success");
    expect(out.result.pr_url).toMatch(/pull\/42$/);
    expect(out.warnings).toHaveLength(0);
  });

  it("captures abandoned outcome cleanly", () => {
    const out = validateSpecImplResult(
      {
        phase: "impl",
        outcome: "abandoned",
        reason: "spec is wrong",
        tokens_used: 100,
        cost_usd: 0.005,
      },
      opts
    );
    expect(out.result.outcome).toBe("abandoned");
    expect(out.result.reason).toBe("spec is wrong");
    expect(out.result.pr_url).toBeNull();
  });

  it("rejects branch mismatch", () => {
    expect(() =>
      validateSpecImplResult(
        {
          phase: "impl",
          pr_url: "https://github.com/x/y/pull/42",
          branch: "main",
          files_changed: ["apps/web/lib/x.ts"],
          tests_added: [],
          tests_run: ["x.test.ts"],
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/branch/);
  });

  it("rejects files outside allowlist", () => {
    expect(() =>
      validateSpecImplResult(
        {
          phase: "impl",
          pr_url: "https://github.com/x/y/pull/42",
          branch: opts.expectedBranch,
          files_changed: ["apps/web/lib/x.ts", "apps/web/lib/sneaky.ts"],
          tests_added: [],
          tests_run: [],
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/allowlist/);
  });

  it("rejects PR URL that's not a github.com URL", () => {
    expect(() =>
      validateSpecImplResult(
        {
          phase: "impl",
          pr_url: "https://example.com/pull/42",
          branch: opts.expectedBranch,
          files_changed: ["apps/web/lib/x.ts"],
          tests_added: [],
          tests_run: ["x.test.ts"],
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/github\.com/);
  });

  it("warns when no tests are run", () => {
    const out = validateSpecImplResult(
      {
        phase: "impl",
        pr_url: "https://github.com/x/y/pull/42",
        branch: opts.expectedBranch,
        files_changed: ["apps/web/lib/__tests__/x.test.ts"],
        tests_added: ["apps/web/lib/__tests__/x.test.ts"],
        tests_run: [],
        tokens_used: 0,
        cost_usd: 0,
      },
      opts
    );
    expect(out.warnings).toContain("no_tests_run");
  });
});
