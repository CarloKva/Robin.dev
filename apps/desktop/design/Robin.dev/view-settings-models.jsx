// Settings · Brains — subscriptions first.
// Layout: 1) connected subscriptions (Anthropic, OpenAI, Google, etc.) with
// API keys, monthly cap, usage. 2) brain picker (workspace default + per-
// engineer). 3) auto-switch rules when a subscription hits its cap.

const SUBSCRIPTIONS = [
  {
    id: "anthropic", name: "Anthropic", color: "#d97757", initials: "A",
    key: "sk-ant-***cQ2x", key_set: true,
    cap: 500, spent: 312.20, tokens: "161 M",
    models: ["Claude Opus 4", "Claude Sonnet 4.5", "Claude Haiku 4.5"],
    plan: "Pay-as-you-go", primary: true,
  },
  {
    id: "openai", name: "OpenAI", color: "#10a37f", initials: "O",
    key: "sk-proj-***vRqs", key_set: true,
    cap: 200, spent: 47.10, tokens: "12 M",
    models: ["GPT-5", "GPT-5 mini", "o4-mini"],
    plan: "Tier 4",
  },
  {
    id: "google", name: "Google AI", color: "#4285f4", initials: "G",
    key: null, key_set: false,
    cap: 0, spent: 0, tokens: "0",
    models: ["Gemini 2.5 Pro", "Gemini 2.5 Flash"],
    plan: "Not connected",
  },
  {
    id: "openrouter", name: "OpenRouter", color: "#7b61ff", initials: "OR",
    key: "sk-or-v1-***A4xz", key_set: true,
    cap: 100, spent: 8.40, tokens: "2.3 M",
    models: ["DeepSeek V3", "Llama 4 Maverick", "Qwen 3"],
    plan: "Fallback only",
  },
];

const BRAINS = [
  {
    id: "opus", name: "Opus 4", fullName: "Claude Opus 4", provider: "anthropic",
    colorKey: "accent",
    inputCost: 15, outputCost: 75,
    context: 200, latency: "deliberate",
    desc: "Deepest thinker. The right brain for gnarly refactors, ambiguous architecture, hard debugging.",
    when: ["Long-horizon refactor", "Multi-file rewrites", "Hard debug"],
  },
  {
    id: "sonnet", name: "Sonnet 4.5", fullName: "Claude Sonnet 4.5", provider: "anthropic",
    colorKey: "success", recommended: true,
    inputCost: 3, outputCost: 15,
    context: 200, latency: "fast",
    desc: "All-round craftsperson. Sensible default for feature work, bugfixes, and code review.",
    when: ["Feature work", "Bugfixes", "PR review", "Most tasks"],
  },
  {
    id: "gpt5", name: "GPT-5", fullName: "GPT-5", provider: "openai",
    colorKey: "info",
    inputCost: 5, outputCost: 25,
    context: 256, latency: "fast",
    desc: "Strong at structured outputs and tool use. Used as Anthropic-fallback for spike load.",
    when: ["Structured output", "Tool-heavy", "Fallback"],
  },
  {
    id: "haiku", name: "Haiku 4.5", fullName: "Claude Haiku 4.5", provider: "anthropic",
    colorKey: "info",
    inputCost: 0.8, outputCost: 4,
    context: 200, latency: "instant",
    desc: "The intern with great instincts. Doc tweaks, dep bumps, UI nudges where speed beats depth.",
    when: ["Docs", "Dep bumps", "Trivial UI"],
  },
];

const SettingsBrainsView = () => {
  const t = useTheme();
  const [defaultBrain, setDefaultBrain] = React.useState("sonnet");

  const usage = BRAINS.map(b => ({
    ...b,
    agents: MOCK_AGENTS.filter(a => a.brain.toLowerCase().includes(b.id) || (b.id === "sonnet" && a.brain.includes("Sonnet"))),
  }));

  return (
    <SettingsShell
      active="brains"
      title="Brains"
      subtitle="Connect AI providers, set monthly caps, and pick the brain each engineer uses."
      label="08 · Settings · Brains"
    >
      <div style={{ padding: "22px 28px 12px" }}>

        {/* Subscriptions */}
        <SectionTitle title="Subscriptions" sub="API keys, plans, and live spend across providers." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 28 }}>
          {SUBSCRIPTIONS.map(s => <SubscriptionCard key={s.id} sub={s} />)}
        </div>

        {/* Workspace default brain */}
        <SectionTitle title="Workspace default brain" sub="Applied to every engineer unless overridden." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 22 }}>
          {BRAINS.map(b => {
            const active = defaultBrain === b.id;
            const sub = SUBSCRIPTIONS.find(s => s.id === b.provider);
            const color = t[b.colorKey];
            const soft = t[b.colorKey + "Soft"];
            const border = t[b.colorKey + "Border"];
            return (
              <button key={b.id} onClick={() => setDefaultBrain(b.id)} style={{
                textAlign: "left",
                background: active ? soft : t.popover,
                border: `1.5px solid ${active ? border : t.divider}`,
                borderRadius: 12, padding: "14px",
                cursor: "pointer", fontFamily: "inherit",
                position: "relative",
                boxShadow: active ? `0 3px 10px ${soft}` : "0 1px 2px rgba(85,65,30,0.04)",
                transition: "all 0.15s",
              }}>
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  width: 16, height: 16, borderRadius: "50%",
                  background: active ? color : "transparent",
                  border: `1.5px solid ${active ? color : t.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {active && <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2 4.5 L4 6.5 L7 2.5" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <BrainChip name={b.fullName} />
                  {b.recommended && (
                    <span style={{ fontSize: 9.5, color: t.accent, fontWeight: 600, padding: "1px 6px", background: t.accentSoft, borderRadius: 999, whiteSpace: "nowrap" }}>recommended</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: t.ink3, marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  via <ProviderTag sub={sub} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
                  <Stat label="In" value={`$${b.inputCost}`} unit="/M" />
                  <Stat label="Out" value={`$${b.outputCost}`} unit="/M" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Auto-switch rule */}
        <div style={{
          marginBottom: 22, padding: "14px 16px",
          background: t.panel, borderRadius: 12,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: t.warningSoft, color: t.warning,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9 a6 6 0 0 1 10 -4 M15 9 a6 6 0 0 1 -10 4 M13 2 v3 h-3 M5 16 v-3 h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>Auto-switch when caps hit</div>
            <div style={{ fontSize: 11.5, color: t.ink3, marginTop: 3, lineHeight: 1.45 }}>
              If <ProviderTag sub={SUBSCRIPTIONS[0]} inline /> hits its monthly cap, route to <ProviderTag sub={SUBSCRIPTIONS[1]} inline /> · then <BrainChip name="Claude Haiku 4.5" size="sm" /> on rate-limit.
            </div>
          </div>
          <Btn variant="secondary" size="sm">Edit rule</Btn>
        </div>

        {/* Per-engineer */}
        <SectionTitle title="Per-engineer brain" sub="Override the default for any engineer." />
        <div style={{
          background: t.popover,
          border: `1px solid ${t.divider}`,
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 28,
        }}>
          {usage.map((b, i) => {
            const color = t[b.colorKey];
            const sub = SUBSCRIPTIONS.find(s => s.id === b.provider);
            return (
              <div key={b.id} style={{
                display: "grid", gridTemplateColumns: "190px 1fr",
                alignItems: "center", gap: 18,
                padding: "12px 16px",
                borderBottom: i === usage.length - 1 ? "none" : `1px solid ${t.divider}`,
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <BrainChip name={b.fullName} />
                  <span style={{ fontSize: 10.5, color: t.ink3, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    via <ProviderTag sub={sub} inline />
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {b.agents.length === 0
                    ? <span style={{ color: t.ink4, fontSize: 12, fontStyle: "italic" }}>nobody yet</span>
                    : b.agents.map(a => (
                      <span key={a.id} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "3px 10px 3px 3px",
                        background: t.panel, borderRadius: 999,
                        fontSize: 11.5, fontWeight: 500, whiteSpace: "nowrap",
                      }}>
                        <Avatar agent={a} size="xs" showStatus={false} />
                        <span style={{ color: t.ink }}>{a.name.split(" ")[0]}</span>
                      </span>
                    ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SettingsShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Subscription card — provider with API key + spend + cap

const SubscriptionCard = ({ sub }) => {
  const t = useTheme();
  const pct = sub.cap > 0 ? (sub.spent / sub.cap) * 100 : 0;
  const danger = pct > 80;
  const warn = pct > 60 && pct <= 80;
  return (
    <div style={{
      background: t.popover,
      border: `1px solid ${sub.primary ? t.accentBorder : t.divider}`,
      borderRadius: 12,
      padding: "14px 16px",
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <ProviderLogo sub={sub} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>{sub.name}</span>
            {sub.primary && (
              <span style={{ fontSize: 9.5, color: t.accent, fontWeight: 600, padding: "1px 6px", borderRadius: 999, background: t.accentSoft, whiteSpace: "nowrap" }}>primary</span>
            )}
            {!sub.key_set && (
              <span style={{ fontSize: 9.5, color: t.ink3, fontWeight: 600, padding: "1px 6px", borderRadius: 999, background: t.panel, whiteSpace: "nowrap" }}>not connected</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: t.ink3, marginTop: 3 }}>
            {sub.plan}
          </div>
        </div>
        <button style={{
          width: 26, height: 26, borderRadius: 7,
          background: "transparent", border: `1px solid ${t.border}`,
          color: t.ink2, cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11">
            <circle cx="5.5" cy="2.5" r="0.9" fill="currentColor"/>
            <circle cx="5.5" cy="5.5" r="0.9" fill="currentColor"/>
            <circle cx="5.5" cy="8.5" r="0.9" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* API key row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px",
        background: t.panel, borderRadius: 8,
        marginBottom: 10,
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: t.ink3, flexShrink: 0 }}>
          <circle cx="4" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M6.5 6 h4 M9 6 v2 M10.5 6 v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span style={{
          fontSize: 11.5, fontFamily: "'Geist Mono', monospace", color: sub.key_set ? t.ink : t.ink4,
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {sub.key_set ? sub.key : "Add an API key to connect"}
        </span>
        <Btn variant="ghost" size="sm">{sub.key_set ? "Rotate" : "Connect"}</Btn>
      </div>

      {/* Usage */}
      {sub.key_set && sub.cap > 0 ? (
        <div>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            marginBottom: 5, fontSize: 11.5,
          }}>
            <span style={{ color: t.ink3 }}>
              This month
            </span>
            <span style={{ color: t.ink, fontWeight: 600, fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap" }}>
              ${sub.spent.toFixed(2)}<span style={{ color: t.ink3, fontWeight: 500 }}> / ${sub.cap}</span>
            </span>
          </div>
          <div style={{
            height: 5, borderRadius: 3, overflow: "hidden",
            background: t.divider,
            marginBottom: 8,
          }}>
            <div style={{
              height: "100%",
              width: `${Math.min(pct, 100)}%`,
              background: danger ? t.danger : warn ? t.warning : t.success,
              transition: "width 0.4s",
            }} />
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 10.5, color: t.ink3,
          }}>
            <span style={{ fontFamily: "'Geist Mono', monospace" }}>{sub.tokens} tokens</span>
            <span style={{ color: t.ink4 }}>·</span>
            <span>{sub.models.length} brain{sub.models.length === 1 ? "" : "s"}</span>
            {danger && (
              <>
                <span style={{ flex: 1 }} />
                <span style={{ color: t.danger, fontWeight: 600, whiteSpace: "nowrap" }}>
                  near cap
                </span>
              </>
            )}
          </div>
        </div>
      ) : !sub.key_set ? (
        <div style={{ fontSize: 11.5, color: t.ink3, lineHeight: 1.5 }}>
          Connect to enable {sub.models.slice(0, 2).join(", ")}{sub.models.length > 2 ? `, +${sub.models.length - 2} more` : ""}.
        </div>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider logo

const ProviderLogo = ({ sub, size = 32 }) => (
  <span style={{
    width: size, height: size, borderRadius: size * 0.25,
    background: sub.color,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#ffffff", fontWeight: 700,
    fontSize: size * 0.4,
    flexShrink: 0,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
  }}>{sub.initials}</span>
);

const ProviderTag = ({ sub, inline }) => {
  const t = useTheme();
  if (!sub) return <span style={{ color: t.ink4 }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: inline ? "1px 7px" : "2px 9px",
      background: t.panel, borderRadius: 999,
      fontSize: inline ? 10.5 : 11, fontWeight: 500,
      color: t.ink2, whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 2,
        background: sub.color,
      }} />
      {sub.name}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

const SectionTitle = ({ title, sub }) => {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.ink, letterSpacing: -0.1 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: t.ink3, marginTop: 3 }}>{sub}</div>}
    </div>
  );
};

const Stat = ({ label, value, unit, mono }) => {
  const t = useTheme();
  return (
    <div style={{ whiteSpace: "nowrap" }}>
      <div style={{ fontSize: 9.5, color: t.ink4, fontWeight: 600, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, fontFamily: mono ? "'Geist Mono', monospace" : "inherit" }}>{value}</span>
        {unit && <span style={{ fontSize: 9.5, color: t.ink3, fontFamily: "'Geist Mono', monospace" }}>{unit}</span>}
      </div>
    </div>
  );
};

window.SettingsBrainsView = SettingsBrainsView;
window.SUBSCRIPTIONS = SUBSCRIPTIONS;
window.ProviderLogo = ProviderLogo;
window.ProviderTag = ProviderTag;
