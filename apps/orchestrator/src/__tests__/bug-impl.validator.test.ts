import { describe, it, expect } from "vitest";
import { validateBugImplRepro, validateBugImplFix } from "../services/bug-impl.validator";

const PROTECTED = [".env*", "supabase/migrations/**", ".github/workflows/**"];

describe("validateBugImplRepro", () => {
  const opts = { protectedPaths: PROTECTED };

  it("accepts a well-formed reproduced output", () => {
    const r = validateBugImplRepro(
      {
        phase: "repro",
        outcome: "reproduced",
        regression_test_path: "apps/web/lib/__tests__/x.test.ts",
        failure_output: "TypeError: ...",
        tokens_used: 100,
        cost_usd: 0.01,
      },
      opts
    );
    expect(r.outcome).toBe("reproduced");
    expect(r.regression_test_path).toBe("apps/web/lib/__tests__/x.test.ts");
  });

  it("accepts cannot_reproduce without a regression path", () => {
    const r = validateBugImplRepro(
      {
        phase: "repro",
        outcome: "cannot_reproduce",
        failure_output: null,
        tokens_used: 50,
        cost_usd: 0.005,
      },
      opts
    );
    expect(r.outcome).toBe("cannot_reproduce");
    expect(r.regression_test_path).toBeNull();
  });

  it("rejects reproduced without a regression test path", () => {
    expect(() =>
      validateBugImplRepro(
        {
          phase: "repro",
          outcome: "reproduced",
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/regression_test_path/);
  });

  it("rejects regression path that doesn't look like a test file", () => {
    expect(() =>
      validateBugImplRepro(
        {
          phase: "repro",
          outcome: "reproduced",
          regression_test_path: "apps/web/lib/x.ts",
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/test file/);
  });

  it("rejects regression path in protected_paths", () => {
    expect(() =>
      validateBugImplRepro(
        {
          phase: "repro",
          outcome: "reproduced",
          regression_test_path: ".github/workflows/test.spec.yml",
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/protected/);
  });

  it("rejects invalid outcome", () => {
    expect(() =>
      validateBugImplRepro(
        {
          phase: "repro",
          outcome: "maybe",
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/outcome/);
  });
});

describe("validateBugImplFix", () => {
  const branch = "fix/bug-deadbeef-checkout-crash";
  const opts = {
    protectedPaths: PROTECTED,
    expectedBranch: branch,
    reproRegressionTestPath: "apps/web/lib/__tests__/x.test.ts",
  };

  it("accepts a well-formed success result", () => {
    const r = validateBugImplFix(
      {
        phase: "fix",
        outcome: "success",
        pr_url: "https://github.com/x/y/pull/42",
        branch,
        regression_test_path: "apps/web/lib/__tests__/x.test.ts",
        files_changed: [
          "apps/web/lib/x.ts",
          "apps/web/lib/__tests__/x.test.ts",
        ],
        tests_run: ["x.test.ts"],
        tokens_used: 1000,
        cost_usd: 0.05,
      },
      opts
    );
    expect(r.result.outcome).toBe("success");
    expect(r.warnings).not.toContain("regression_test_not_in_files_changed");
  });

  it("rejects branch mismatch", () => {
    expect(() =>
      validateBugImplFix(
        {
          phase: "fix",
          outcome: "success",
          pr_url: "https://github.com/x/y/pull/42",
          branch: "main",
          regression_test_path: opts.reproRegressionTestPath,
          files_changed: ["apps/web/lib/x.ts", opts.reproRegressionTestPath],
          tests_run: ["x.test.ts"],
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/branch/);
  });

  it("captures needs_design outcome", () => {
    const r = validateBugImplFix(
      {
        phase: "fix",
        outcome: "needs_design",
        branch,
        reason: "fix would touch 5 files",
        tokens_used: 100,
        cost_usd: 0.01,
      },
      opts
    );
    expect(r.result.outcome).toBe("needs_design");
    expect(r.result.reason).toBe("fix would touch 5 files");
    expect(r.result.pr_url).toBeNull();
  });

  it("captures abandoned outcome", () => {
    const r = validateBugImplFix(
      {
        phase: "fix",
        outcome: "abandoned",
        branch,
        reason: "finding wrong",
        tokens_used: 100,
        cost_usd: 0.01,
      },
      opts
    );
    expect(r.result.outcome).toBe("abandoned");
  });

  it("rejects more than 3 non-test files changed", () => {
    expect(() =>
      validateBugImplFix(
        {
          phase: "fix",
          outcome: "success",
          pr_url: "https://github.com/x/y/pull/42",
          branch,
          regression_test_path: opts.reproRegressionTestPath,
          files_changed: [
            "apps/web/lib/a.ts",
            "apps/web/lib/b.ts",
            "apps/web/lib/c.ts",
            "apps/web/lib/d.ts",
            opts.reproRegressionTestPath,
          ],
          tests_run: ["x.test.ts"],
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/exceeds cap/);
  });

  it("rejects files in protected_paths", () => {
    expect(() =>
      validateBugImplFix(
        {
          phase: "fix",
          outcome: "success",
          pr_url: "https://github.com/x/y/pull/42",
          branch,
          regression_test_path: opts.reproRegressionTestPath,
          files_changed: ["supabase/migrations/0099.sql", opts.reproRegressionTestPath],
          tests_run: ["x.test.ts"],
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/protected/);
  });

  it("rejects non-github.com pr_url", () => {
    expect(() =>
      validateBugImplFix(
        {
          phase: "fix",
          outcome: "success",
          pr_url: "https://gitlab.com/x/y/-/merge_requests/1",
          branch,
          regression_test_path: opts.reproRegressionTestPath,
          files_changed: ["apps/web/lib/x.ts", opts.reproRegressionTestPath],
          tests_run: ["x.test.ts"],
          tokens_used: 0,
          cost_usd: 0,
        },
        opts
      )
    ).toThrow(/github\.com/);
  });

  it("warns when regression test is not in files_changed", () => {
    const r = validateBugImplFix(
      {
        phase: "fix",
        outcome: "success",
        pr_url: "https://github.com/x/y/pull/42",
        branch,
        regression_test_path: opts.reproRegressionTestPath,
        files_changed: ["apps/web/lib/x.ts"],
        tests_run: ["x.test.ts"],
        tokens_used: 0,
        cost_usd: 0,
      },
      opts
    );
    expect(r.warnings).toContain("regression_test_not_in_files_changed");
  });

  it("warns when regression path changed between phases", () => {
    const r = validateBugImplFix(
      {
        phase: "fix",
        outcome: "success",
        pr_url: "https://github.com/x/y/pull/42",
        branch,
        regression_test_path: "apps/web/lib/__tests__/different.test.ts",
        files_changed: [
          "apps/web/lib/x.ts",
          "apps/web/lib/__tests__/different.test.ts",
        ],
        tests_run: ["different.test.ts"],
        tokens_used: 0,
        cost_usd: 0,
      },
      opts
    );
    expect(r.warnings).toContain("regression_test_path_changed_between_phases");
  });
});
