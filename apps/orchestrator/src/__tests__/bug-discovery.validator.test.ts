import { describe, it, expect } from "vitest";
import { validateBugDiscoveryOutput } from "../services/bug-discovery.validator";

const PROTECTED = [".env*", "supabase/migrations/**", ".github/workflows/**"];

function baseFinding(overrides: Record<string, unknown> = {}) {
  return {
    title: "Null deref in checkout flow",
    description: "Production users hit a TypeError on /checkout when cart is empty.",
    severity: "P1",
    hypothesis: "cart array is sometimes null after the new session refactor.",
    evidence: {
      stack_trace: "TypeError: Cannot read 'length' of null\n  at checkout.tsx:48",
      sentry_issue_id: "ABCD-1234",
    },
    affected_paths: ["apps/web/app/checkout/page.tsx"],
    confidence: 0.9,
    source: "sentry",
    source_ref: "ABCD-1234",
    ...overrides,
  };
}

function wrap(findings: unknown[]) {
  return {
    findings,
    summary: "",
    tokens_used: 0,
    cost_usd: 0,
  };
}

describe("validateBugDiscoveryOutput", () => {
  const opts = () => ({ protectedPaths: PROTECTED });

  it("throws on missing top-level fields", () => {
    expect(() => validateBugDiscoveryOutput({ findings: "no" } as never, opts())).toThrow();
    expect(() =>
      validateBugDiscoveryOutput({ findings: [], summary: 1 } as never, opts())
    ).toThrow();
  });

  it("accepts a well-formed Sentry-backed P1 finding", () => {
    const r = validateBugDiscoveryOutput(wrap([baseFinding()]), opts());
    expect(r.output.findings).toHaveLength(1);
    expect(r.dropped).toHaveLength(0);
  });

  it("drops P0/P1 without runtime evidence", () => {
    const r = validateBugDiscoveryOutput(
      wrap([
        baseFinding({
          evidence: {},
          severity: "P0",
          source: "static_analysis",
        }),
      ]),
      opts()
    );
    expect(r.output.findings).toHaveLength(0);
    expect(r.dropped[0]?.reason).toBe("high_severity_without_runtime_evidence");
  });

  it("drops static_analysis findings at P1 (cap to P2)", () => {
    const r = validateBugDiscoveryOutput(
      wrap([
        baseFinding({
          source: "static_analysis",
          severity: "P1",
          evidence: { code_excerpt: "foo" },
        }),
      ]),
      opts()
    );
    expect(r.output.findings).toHaveLength(0);
    expect(["high_severity_without_runtime_evidence", "static_findings_capped_at_p2"]).toContain(
      r.dropped[0]?.reason
    );
  });

  it("drops static findings below confidence floor", () => {
    const r = validateBugDiscoveryOutput(
      wrap([
        baseFinding({
          source: "static_analysis",
          severity: "P2",
          confidence: 0.5,
          evidence: {},
          source_ref: null,
        }),
      ]),
      opts()
    );
    expect(r.output.findings).toHaveLength(0);
    expect(r.dropped[0]?.reason).toBe("static_confidence_below_floor");
  });

  it("keeps static_analysis P2 with confidence >= 0.75", () => {
    const r = validateBugDiscoveryOutput(
      wrap([
        baseFinding({
          source: "static_analysis",
          severity: "P2",
          confidence: 0.8,
          evidence: { code_excerpt: "x" },
          source_ref: null,
        }),
      ]),
      opts()
    );
    expect(r.output.findings).toHaveLength(1);
  });

  it("drops findings whose affected_paths hit protected_paths", () => {
    const r = validateBugDiscoveryOutput(
      wrap([
        baseFinding({
          affected_paths: ["supabase/migrations/0042.sql"],
        }),
      ]),
      opts()
    );
    expect(r.output.findings).toHaveLength(0);
    expect(r.dropped[0]?.reason).toBe("affected_path_protected");
  });

  it("caps at maxFindings preferring higher severity then confidence", () => {
    const findings = [
      baseFinding({ severity: "P3", source: "static_analysis", evidence: {}, confidence: 0.9 }),
      baseFinding({ severity: "P2", source: "static_analysis", evidence: {}, confidence: 0.8 }),
      baseFinding({ severity: "P0", confidence: 0.95 }),
      baseFinding({ severity: "P1", confidence: 0.95 }),
    ];
    const r = validateBugDiscoveryOutput(wrap(findings), { ...opts(), maxFindings: 2 });
    expect(r.output.findings).toHaveLength(2);
    expect(r.output.findings[0]?.severity).toBe("P0");
    expect(r.output.findings[1]?.severity).toBe("P1");
  });

  it("rejects invalid severity / source values", () => {
    const r = validateBugDiscoveryOutput(
      wrap([
        baseFinding({ severity: "WAT" }),
        baseFinding({ source: "wikipedia" }),
      ]),
      opts()
    );
    expect(r.output.findings).toHaveLength(0);
    expect(r.dropped.map((d) => d.reason)).toContain("invalid_severity");
    expect(r.dropped.map((d) => d.reason)).toContain("invalid_source");
  });
});
