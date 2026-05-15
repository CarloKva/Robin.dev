// Popover view: ROBIN CHAT — natural-language orchestration.
// You prompt Robin (the orchestrator), it decides who picks up the work.

const RobinChatView = () => {
  const t = useTheme();
  const available = MOCK_AGENTS.filter(a => a.status === "available");

  return (
    <PopoverShell label="04 · Chat with Robin.dev" sublabel="orchestrator — assign work in plain English">
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px",
        borderBottom: `1px solid ${t.divider}`,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: "linear-gradient(135deg, #ff7e58, #d63916)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <RobinGlyph size={15} color="#fff7f3" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>Robin.dev</div>
          <div style={{ fontSize: 11, color: t.ink3, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
            <LiveDot size={4} />
            orchestrator · routes work to your team
          </div>
        </div>
        <IconBtn title="History">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M7 4.5 v2.5 l1.8 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </IconBtn>
      </div>

      {/* Available now strip */}
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${t.divider}`,
        background: t.panel,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 11, color: t.ink3, fontWeight: 600, whiteSpace: "nowrap" }}>
          Available now
        </span>
        <div style={{ display: "flex", marginLeft: 2 }}>
          {available.map((a, i) => (
            <span key={a.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <Avatar agent={a} size="xs" showStatus={false} />
            </span>
          ))}
        </div>
        <span style={{ fontSize: 11, color: t.ink3, whiteSpace: "nowrap" }}>
          {available.map(a => a.name.split(" ")[0]).join(" · ")}
        </span>
      </div>

      {/* Chat thread */}
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        <ChatBubble role="robin" at="just now"
          text={`Hi ${MOCK_WORKSPACE.member}. Nora and Sofia are free this morning, Theo is still setting up his workstation. What's on your mind?`} />

        {/* Suggested prompts */}
        <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10.5, color: t.ink4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Try
          </div>
          <SuggestionRow tone="info" icon={<SuggestIcon name="audit" />}
            text="Have someone audit our 4xx error pages and propose better copy." />
          <SuggestionRow tone="danger" icon={<SuggestIcon name="flask" />}
            text="Sofia — run flaky-test triage on the workers suite." />
          <SuggestionRow tone="success" icon={<SuggestIcon name="rocket" />}
            text="Ship a one-pager landing page for the new pricing tier." />
          <SuggestionRow tone="accent" icon={<SuggestIcon name="pair" />}
            text="Pair Aria and Nora on the checkout refactor." />
        </div>
      </div>

      {/* Composer */}
      <div style={{
        padding: "10px 12px",
        background: t.popover,
        borderTop: `1px solid ${t.divider}`,
      }}>
        <RepoSelector />
        <ChatComposer placeholder="Tell Robin what to do…" sendLabel="Send" />
        <div style={{
          marginTop: 6, fontSize: 10.5, color: t.ink4,
          display: "flex", alignItems: "center", gap: 5, justifyContent: "center",
        }}>
          Robin picks the right engineer · you can override with <Kbd>@</Kbd>
        </div>
      </div>
    </PopoverShell>
  );
};

const REPOS = [
  { name: "any", label: "Any repo" },
  { name: "kakashi/api-gateway" },
  { name: "kakashi/billing-core" },
  { name: "kakashi/web-app" },
  { name: "kakashi/mobile-ios" },
  { name: "kakashi/design-system" },
  { name: "kakashi/infra" },
  { name: "kakashi/cli" },
];

const RepoSelector = () => {
  const t = useTheme();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(REPOS[0]);
  const isAny = selected.name === "any";
  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "5px 10px 5px 9px",
        background: t.panel,
        border: `1px solid ${t.divider}`,
        borderRadius: 999,
        cursor: "pointer", fontFamily: "inherit",
        fontSize: 11.5, color: t.ink2,
      }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.7 }}>
          <path d="M2 1.5 h6 a1 1 0 0 1 1 1 v6.5 a1 1 0 0 1 -1 1 H3 a1 1 0 0 1 -1 -1 z M3 7.5 h6" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
        </svg>
        <span style={{ color: t.ink3, fontWeight: 500 }}>Work in</span>
        <span style={{
          color: isAny ? t.ink3 : t.ink,
          fontWeight: 600,
          fontFamily: isAny ? "inherit" : "'Geist Mono', monospace",
          fontSize: isAny ? 11.5 : 11,
        }}>
          {isAny ? selected.label : selected.name.split("/")[1]}
        </span>
        <svg width="9" height="9" viewBox="0 0 9 9" style={{ color: t.ink3 }}>
          <path d="M2.5 3.5 L4.5 5.5 L6.5 3.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          background: t.popover,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          boxShadow: "0 6px 18px rgba(85,65,30,0.16)",
          padding: 4, minWidth: 220, zIndex: 10,
        }}>
          {REPOS.map(r => {
            const active = r.name === selected.name;
            return (
              <button key={r.name} onClick={() => { setSelected(r); setOpen(false); }} style={{
                width: "100%", textAlign: "left",
                padding: "7px 9px",
                background: active ? t.accentSoft : "transparent",
                border: "none", borderRadius: 7,
                fontFamily: "inherit", fontSize: 12,
                color: active ? t.accent : t.ink, fontWeight: active ? 600 : 500,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.hover; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                {r.name === "any" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M3 5.5 h5 M5.5 3 v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {r.label}
                  </span>
                ) : (
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5 }}>{r.name}</span>
                )}
                {active && (
                  <span style={{ marginLeft: "auto" }}>
                    <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 5.5 L4.5 8 L9 3" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SuggestionRow = ({ icon, text, tone = "info" }) => {
  const t = useTheme();
  const toneColor = { info: t.info, danger: t.danger, success: t.success, accent: t.accent }[tone] || t.ink2;
  const toneSoft = { info: t.infoSoft, danger: t.dangerSoft, success: t.successSoft, accent: t.accentSoft }[tone] || t.panel;
  return (
    <button style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 11px",
      background: t.panel,
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "inherit",
      transition: "background 0.12s",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = t.hover}
    onMouseLeave={(e) => e.currentTarget.style.background = t.panel}>
      <span style={{
        width: 26, height: 26, borderRadius: 7,
        background: toneSoft,
        color: toneColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{icon}</span>
      <span style={{ fontSize: 12.5, color: t.ink2, lineHeight: 1.4, flex: 1 }}>
        {text}
      </span>
      <svg width="11" height="11" viewBox="0 0 11 11" style={{ color: t.ink4, flexShrink: 0 }}>
        <path d="M3 2 L7 5.5 L3 9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
};

const SuggestIcon = ({ name }) => {
  if (name === "audit") return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="2.5" y="1.5" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4.5 4.5 h4 M4.5 6.5 h4 M4.5 8.5 h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
  if (name === "flask") return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M5 1.5 v3 L2.5 9 a1 1 0 0 0 1 1.5 h6 a1 1 0 0 0 1 -1.5 L8 4.5 v-3 z M4 1.5 h5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="5" cy="8" r="0.7" fill="currentColor"/>
      <circle cx="7" cy="9" r="0.6" fill="currentColor"/>
    </svg>
  );
  if (name === "rocket") return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5 c2 1 3 3 3 5 L6.5 9 L3.5 6.5 c0 -2 1 -4 3 -5 z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="6.5" cy="5" r="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M5 9 L4 11 M8 9 L9 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
  if (name === "pair") return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="4.5" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="9" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1.5 11 c0 -2 1.5 -3.5 3 -3.5 s3 1.5 3 3.5 M7 11 c0 -1.5 1 -2.8 2 -2.8 s2 1.3 2 2.8" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  );
  return null;
};

Object.assign(window, { RobinChatView });
