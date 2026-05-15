// Popover view: SETTINGS — compact summary of every settings page.
// Each row is a tappable card that previews what lives on the matching
// settings page in the expanded window.

const SettingsPanelView = () => {
  const t = useTheme();
  const enabledRepos = 2;
  const totalRepos = 38;
  const installedCaps = MOCK_CAPABILITIES.filter(c => c.installed_by.length > 0).length;
  const totalCaps = MOCK_CAPABILITIES.length;
  const connectedSubs = window.SUBSCRIPTIONS ? window.SUBSCRIPTIONS.filter(s => s.key_set).length : 3;
  const totalSubs = window.SUBSCRIPTIONS ? window.SUBSCRIPTIONS.length : 4;
  const monthSpend = window.SUBSCRIPTIONS
    ? window.SUBSCRIPTIONS.reduce((sum, s) => sum + (s.spent || 0), 0)
    : 367.7;
  const monthCap = window.SUBSCRIPTIONS
    ? window.SUBSCRIPTIONS.reduce((sum, s) => sum + (s.cap || 0), 0)
    : 800;

  return (
    <PopoverShell label="07 · Settings" sublabel="snapshot of every settings page">
      <PopoverHeader workspace={MOCK_WORKSPACE} connected />

      <div style={{ padding: "14px 16px 6px" }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: t.ink, letterSpacing: -0.2 }}>
          Settings
        </div>
        <div style={{ fontSize: 12.5, color: t.ink3, marginTop: 4, lineHeight: 1.45 }}>
          A snapshot of every config page. Open the web app to edit.
        </div>
      </div>

      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px" }}>
        {/* Workspace */}
        <SettingsCard
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="10" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 3 v-1 h4 v1" stroke="currentColor" strokeWidth="1.3"/></svg>}
          tone="neutral"
          title="Workspace"
          subtitle={`${MOCK_WORKSPACE.name} · robin.dev/kva`}
        >
          <RowKV k="Created" v="Mar 1, 2026" />
          <RowKV k="Workspace ID" v="904f39de…fc06c3" mono />
          <RowKV k="Region" v={MOCK_WORKSPACE.region} mono />
        </SettingsCard>

        {/* GitHub */}
        <SettingsCard
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 1 a6 6 0 0 0 -2 11.7 c0.3 0.05 0.4 -0.15 0.4 -0.35 v-1.4 c-1.6 0.35 -2 -0.7 -2 -0.7 c-0.3 -0.7 -0.7 -0.9 -0.7 -0.9 c-0.55 -0.4 0.05 -0.4 0.05 -0.4 c0.6 0.05 0.9 0.6 0.9 0.6 c0.5 0.85 1.4 0.6 1.7 0.45 c0.05 -0.4 0.2 -0.65 0.4 -0.8 c-1.3 -0.15 -2.7 -0.65 -2.7 -2.9 c0 -0.65 0.2 -1.15 0.6 -1.55 c-0.05 -0.15 -0.25 -0.75 0.05 -1.55 c0 0 0.5 -0.15 1.6 0.6 a5.5 5.5 0 0 1 2.9 0 c1.1 -0.75 1.6 -0.6 1.6 -0.6 c0.3 0.8 0.1 1.4 0.05 1.55 c0.4 0.4 0.6 0.9 0.6 1.55 c0 2.25 -1.4 2.75 -2.7 2.9 c0.2 0.2 0.4 0.55 0.4 1.1 v1.6 c0 0.2 0.1 0.4 0.4 0.35 a6 6 0 0 0 -2 -11.7"/></svg>}
          tone="info"
          title="GitHub"
          subtitle={`@kakashi-ventures · ${enabledRepos} of ${totalRepos} repos enabled`}
          rightTag={<TagPill tone="success" dot>connected</TagPill>}
        >
          <RowChips chips={["newjee", "unicredit-life-next"]} />
          <RowKV k="Default branch" v="main" mono />
          <RowKV k="Auto-merge" v="staging only" />
        </SettingsCard>

        {/* Brains */}
        <SettingsCard
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2 a3.5 3.5 0 0 0 -3.5 3.5 v3.5 a3.5 3.5 0 0 0 7 0 v-3.5 a3.5 3.5 0 0 0 -3.5 -3.5 z M7 5.5 v3 M5.5 7 h3" stroke="currentColor" strokeWidth="1.3"/></svg>}
          tone="success"
          title="Brains"
          subtitle={`${connectedSubs} of ${totalSubs} providers · $${monthSpend.toFixed(0)} this month`}
          rightTag={<TagPill tone={monthSpend / monthCap > 0.7 ? "warning" : "neutral"}>
            ${monthSpend.toFixed(0)} / ${monthCap}
          </TagPill>}
        >
          <SpendBar spent={monthSpend} cap={monthCap} />
          {window.SUBSCRIPTIONS && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {window.SUBSCRIPTIONS.filter(s => s.key_set).map(s => (
                <span key={s.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "2px 8px", borderRadius: 999,
                  background: t.panel, fontSize: 11, fontWeight: 500, color: t.ink2,
                  whiteSpace: "nowrap",
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color }} />
                  {s.name}
                  <span style={{ color: t.ink3, fontFamily: "'Geist Mono', monospace", fontSize: 10 }}>
                    ${s.spent.toFixed(0)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </SettingsCard>

        {/* Capabilities */}
        <SettingsCard
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5 L11.5 3.5 v3.5 c0 2.2 -1.8 4.3 -4.5 5 c-2.7 -0.7 -4.5 -2.8 -4.5 -5 v-3.5 z M5 7 L6.5 8.5 L9 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/></svg>}
          tone="accent"
          title="Capabilities"
          subtitle={`${installedCaps} installed across the team · ${totalCaps} available`}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {MOCK_CAPABILITIES.filter(c => c.installed_by.length > 0).slice(0, 5).map(c => (
              <span key={c.id} style={{
                fontSize: 10.5, color: t.ink2, fontWeight: 500,
                padding: "2px 8px", borderRadius: 999,
                background: t.panel, whiteSpace: "nowrap",
              }}>{c.name}</span>
            ))}
            {installedCaps > 5 && (
              <span style={{ fontSize: 10.5, color: t.ink3, padding: "2px 4px" }}>+{installedCaps - 5}</span>
            )}
          </div>
        </SettingsCard>

        {/* Team */}
        <SettingsCard
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="10" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.3"/><path d="M2 12 c0 -2.2 1.7 -3.6 3 -3.6 s3 1.4 3 3.6 M8 12 c0 -1.8 1 -3 2 -3 s2 1.2 2 3" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>}
          tone="info"
          title="Team"
          subtitle={`${MOCK_AGENTS.length} engineers · 1 orchestrator`}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex" }}>
              {MOCK_AGENTS.slice(0, 5).map((a, i) => (
                <span key={a.id} style={{ marginLeft: i === 0 ? 0 : -8, position: "relative" }}>
                  <span style={{ display: "inline-block", borderRadius: "50%", boxShadow: `0 0 0 1.5px ${t.popover}` }}>
                    <Avatar agent={a} size="xs" showStatus={false} />
                  </span>
                </span>
              ))}
              {MOCK_AGENTS.length > 5 && (
                <span style={{
                  marginLeft: -8, width: 22, height: 22, borderRadius: "50%",
                  background: t.panel, color: t.ink2,
                  border: `1.5px solid ${t.popover}`,
                  fontSize: 9.5, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>+{MOCK_AGENTS.length - 5}</span>
              )}
            </span>
            <span style={{ fontSize: 11.5, color: t.ink3 }}>
              Aria, Marcus, Yuki, Nora, Theo, Sofia
            </span>
          </div>
        </SettingsCard>

        {/* Notifications */}
        <SettingsCard
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 10 a1 1 0 0 0 1 1 h5 a1 1 0 0 0 1 -1 c-1 -1 -1.5 -2 -1.5 -4.5 a3 3 0 0 0 -6 0 c0 2.5 -0.5 3.5 -1.5 4.5 z M6 12 h2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>}
          tone="neutral"
          title="Notifications"
          subtitle="Email not set · Slack webhook not set"
          rightTag={<TagPill tone="warning">2 to configure</TagPill>}
        />

        {/* Danger zone */}
        <SettingsCard
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5 L13 12 H1 z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7 5 v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="7" cy="10" r="0.6" fill="currentColor"/></svg>}
          tone="danger"
          title="Danger zone"
          subtitle="Delete workspace · Reset data"
        />
      </div>

      <PopoverFooter
        left={<span style={{ fontSize: 11.5, color: t.ink3, paddingLeft: 4 }}>
          Most edits need the web app.
        </span>}
        right={<Btn variant="primary" size="md" icon={
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5 7 L8 4 M5 4 h3 v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><rect x="1.5" y="3" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>
        }>Open settings ↗</Btn>}
      />
    </PopoverShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Card

const SettingsCard = ({ icon, tone, title, subtitle, rightTag, children }) => {
  const t = useTheme();
  const c = t[tone] || t.ink2;
  const soft = t[tone + "Soft"] || t.panel;
  return (
    <button style={{
      width: "100%", textAlign: "left", fontFamily: "inherit",
      background: t.popover,
      border: `1px solid ${t.divider}`,
      borderRadius: 12,
      padding: "12px 12px 12px 12px",
      marginBottom: 8,
      cursor: "pointer",
      transition: "border-color 0.12s, background 0.12s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.hover; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.divider; e.currentTarget.style.background = t.popover; }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 9,
          background: soft, color: c,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>
              {title}
            </span>
            <span style={{ flex: 1 }} />
            {rightTag}
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: t.ink3 }}>
              <path d="M3 2 L7 5 L3 8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{
            fontSize: 11.5, color: t.ink3, lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{subtitle}</div>
        </div>
      </div>
      {children && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px solid ${t.divider}`,
        }}>{children}</div>
      )}
    </button>
  );
};

const TagPill = ({ children, tone = "neutral", dot }) => {
  const t = useTheme();
  const c = t[tone] || t.ink2;
  const soft = t[tone + "Soft"] || t.panel;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10.5, fontWeight: 600, color: c,
      padding: "2px 7px", borderRadius: 999,
      background: soft, whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />}
      {children}
    </span>
  );
};

const RowKV = ({ k, v, mono }) => {
  const t = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "3px 0", fontSize: 11.5,
    }}>
      <span style={{ color: t.ink3 }}>{k}</span>
      <span style={{
        color: t.ink, fontWeight: 500,
        fontFamily: mono ? "'Geist Mono', monospace" : "inherit",
        whiteSpace: "nowrap",
      }}>{v}</span>
    </div>
  );
};

const RowChips = ({ chips }) => {
  const t = useTheme();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
      {chips.map(c => (
        <span key={c} style={{
          fontSize: 10.5, fontFamily: "'Geist Mono', monospace",
          color: t.ink2,
          padding: "1px 7px", borderRadius: 5,
          background: t.panel, whiteSpace: "nowrap",
        }}>{c}</span>
      ))}
    </div>
  );
};

const SpendBar = ({ spent, cap }) => {
  const t = useTheme();
  const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
  const segments = window.SUBSCRIPTIONS
    ? window.SUBSCRIPTIONS.filter(s => s.key_set && s.spent > 0)
    : [];
  return (
    <div>
      <div style={{
        height: 6, borderRadius: 3, overflow: "hidden",
        background: t.divider,
        display: "flex",
      }}>
        {segments.length > 0
          ? segments.map(s => (
              <div key={s.id} style={{
                flex: s.spent,
                background: s.color,
              }} />
            ))
          : (
            <div style={{ width: `${pct}%`, background: t.success, height: "100%" }} />
          )}
      </div>
    </div>
  );
};

Object.assign(window, { SettingsPanelView });
