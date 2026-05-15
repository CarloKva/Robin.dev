// Settings — full window, team-first navigation.
//
// Nav: General · Team · Brains · Code · Workspace · Billing
// Two artboards in this file: SettingsTeamView and SettingsBrainsView.

const SETTINGS_NAV = [
  { id: "general", label: "General", icon: <><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M6 4 v2.5 h1.8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></> },
  { id: "team", label: "Team", icon: <><circle cx="4" cy="4.5" r="1.6" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8.5" cy="4.5" r="1.3" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1.5 10 c0 -1.8 1.5 -3 3 -3 s3 1.2 3 3 M7 10 c0 -1.5 1 -2.5 2 -2.5 s2 1 2 2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></> },
  { id: "brains", label: "Brains", icon: <><path d="M6 1.5 a3 3 0 0 0 -3 3 v3 a3 3 0 0 0 3 3 a3 3 0 0 0 3 -3 v-3 a3 3 0 0 0 -3 -3 z M6 4.5 v3 M4.5 6 h3" stroke="currentColor" strokeWidth="1.2" fill="none"/></> },
  { id: "capabilities", label: "Capabilities", icon: <><path d="M6 1.5 L9.5 3.5 v3 c0 1.8 -1.5 3.5 -3.5 4 c-2 -0.5 -3.5 -2.2 -3.5 -4 v-3 z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><path d="M4.5 6 L5.8 7.3 L7.8 5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></> },
  { id: "github", label: "GitHub", icon: <><path d="M6 1 a4.7 4.7 0 0 0 -1.5 9.15 c0.25 0 0.35 -0.15 0.35 -0.35 v-1.2 c-1.3 0.3 -1.6 -0.6 -1.6 -0.6 c-0.2 -0.55 -0.5 -0.7 -0.5 -0.7 c-0.4 -0.3 0 -0.3 0 -0.3 c0.45 0 0.7 0.5 0.7 0.5 c0.4 0.7 1.1 0.5 1.4 0.4 c0 -0.3 0.15 -0.5 0.3 -0.6 c-1.05 -0.1 -2.1 -0.5 -2.1 -2.3 c0 -0.5 0.17 -0.95 0.45 -1.3 c-0.05 -0.1 -0.2 -0.55 0.05 -1.2 c0 0 0.4 -0.1 1.2 0.45 a4.1 4.1 0 0 1 2.2 0 c0.8 -0.55 1.2 -0.45 1.2 -0.45 c0.25 0.65 0.1 1.1 0.05 1.2 c0.3 0.35 0.45 0.8 0.45 1.3 c0 1.8 -1.05 2.2 -2.1 2.3 c0.2 0.15 0.3 0.4 0.3 0.85 v1.25 c0 0.2 0.1 0.35 0.35 0.35 a4.7 4.7 0 0 0 -1.5 -9.15" stroke="currentColor" strokeWidth="0.6" fill="currentColor"/></> },
  { id: "infra", label: "Infrastructure", icon: <><rect x="1.5" y="2.5" width="9" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="1.5" y="6.5" width="9" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="3" cy="4" r="0.5" fill="currentColor"/><circle cx="3" cy="8" r="0.5" fill="currentColor"/></> },
  { id: "workspace", label: "Workspace", icon: <><rect x="1.5" y="2.5" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M4 2.5 v-1 h4 v1" stroke="currentColor" strokeWidth="1.2" fill="none"/></> },
  { id: "billing", label: "Billing", icon: <><rect x="1.5" y="3" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1.5 5 H10.5" stroke="currentColor" strokeWidth="1.2"/></> },
  { id: "danger", label: "Danger zone", icon: <><path d="M6 1.5 L11 10.5 H1 z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><path d="M6 4.5 v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="6" cy="8.8" r="0.6" fill="currentColor"/></> },
];

const SettingsShell = ({ active, title, subtitle, children, label, headerRight }) => {
  const t = useTheme();
  return (
    <WindowShell title="Robin.dev Settings" subtitle={MOCK_WORKSPACE.name} width={1100} height={680}>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "210px 1fr", minHeight: 0 }}>
        <nav style={{
          borderRight: `1px solid ${t.divider}`,
          background: t.panel,
          padding: "14px 10px",
          display: "flex", flexDirection: "column", gap: 1,
        }}>
          <div style={{
            fontSize: 11, color: t.ink3, fontWeight: 600,
            padding: "4px 10px 10px",
          }}>Workspace</div>
          {SETTINGS_NAV.map(item => {
            const isActive = item.id === active;
            return (
              <button key={item.id} style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "8px 11px",
                background: isActive ? "#ffffff" : "transparent",
                border: "none",
                borderRadius: 7, cursor: "pointer",
                color: isActive ? t.ink : t.ink2,
                fontSize: 12.5, fontFamily: "inherit",
                fontWeight: isActive ? 600 : 500,
                textAlign: "left",
                boxShadow: isActive ? "0 1px 2px rgba(85,65,30,0.06)" : "none",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.85 }}>{item.icon}</svg>
                {item.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{
            margin: "12px 6px 0", padding: "12px",
            background: "#ffffff", borderRadius: 8,
            border: `1px solid ${t.divider}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Avatar agent={{ initials: "M", hue: 200, status: "working" }} size="xs" />
              <div style={{ fontSize: 11.5, color: t.ink, fontWeight: 500, lineHeight: 1.3 }}>
                {MOCK_WORKSPACE.member}
                <div style={{ fontSize: 10, color: t.ink3, fontWeight: 400, marginTop: 1 }}>Orchestrator</div>
              </div>
            </div>
          </div>
        </nav>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: t.popover }}>
          <div style={{
            padding: "20px 28px 18px",
            borderBottom: `1px solid ${t.divider}`,
            display: "flex", alignItems: "flex-end", gap: 16,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: t.ink, marginBottom: 4, letterSpacing: -0.3 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 13, color: t.ink3, lineHeight: 1.45 }}>{subtitle}</div>}
            </div>
            {headerRight}
          </div>
          <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
            {children}
          </div>
        </div>
      </div>
      {label && (
        <div style={{ position: "absolute", bottom: 4, left: 20, color: "rgba(60,50,40,0.55)", fontSize: 11, display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontWeight: 600 }}>{label}</span>
        </div>
      )}
    </WindowShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Settings · Team — directory of engineers as a real company would have

const SettingsTeamView = () => {
  const t = useTheme();
  return (
    <SettingsShell
      active="team"
      title="Team"
      subtitle="Your virtual engineering org. Six engineers, each with their own workstation, brain, and specialty."
      label="07 · Settings · Team"
      headerRight={
        <Btn variant="primary" icon={
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1.5 v8 M1.5 5.5 h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
        }>Hire engineer</Btn>
      }
    >
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14,
        padding: "20px 28px 32px",
      }}>
        {MOCK_AGENTS.map(a => <ProfileCard key={a.id} agent={a} />)}
      </div>
    </SettingsShell>
  );
};

const ProfileCard = ({ agent }) => {
  const t = useTheme();
  const task = agent.current_task_id ? getTask(agent.current_task_id) : null;
  return (
    <div style={{
      background: t.popover,
      border: `1px solid ${t.divider}`,
      borderRadius: 14,
      padding: "18px",
      transition: "border-color 0.15s, box-shadow 0.15s",
      cursor: "pointer",
    }}>
      {/* Header: avatar + name + role + menu */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          <Avatar agent={agent} size="xl" />
          <button
            title="Customize avatar"
            style={{
              position: "absolute", bottom: -2, right: -2,
              width: 26, height: 26, borderRadius: "50%",
              background: t.popover,
              border: `1.5px solid ${t.border}`,
              boxShadow: "0 1px 3px rgba(85,65,30,0.18)",
              color: t.ink,
              cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.12s, background 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.background = t.accentSoft; e.currentTarget.style.borderColor = t.accentBorder; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = t.popover; e.currentTarget.style.borderColor = t.border; }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 9.5 L2.5 7 L8 1.5 a1.4 1.4 0 0 1 2 2 L4.5 9 z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M7 2.5 L9 4.5" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </button>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.ink, lineHeight: 1.2 }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}>{agent.role}</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
            {agent.specialty.map(s => (
              <span key={s} style={{
                fontSize: 10.5, color: t.ink2,
                padding: "2px 8px", borderRadius: 999,
                background: t.panel, fontFamily: "'Geist Mono', monospace",
                lineHeight: 1.3, whiteSpace: "nowrap",
              }}>{s}</span>
            ))}
          </div>
        </div>
        <IconBtn title="More">
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="3" r="1.1" fill="currentColor"/><circle cx="7" cy="7" r="1.1" fill="currentColor"/><circle cx="7" cy="11" r="1.1" fill="currentColor"/></svg>
        </IconBtn>
      </div>

      {/* Bio */}
      <div style={{
        fontSize: 12, color: t.ink2, lineHeight: 1.5,
        fontStyle: "italic",
        marginBottom: 14,
        paddingBottom: 14,
        borderBottom: `1px solid ${t.divider}`,
      }}>
        “{agent.bio}”
      </div>

      {/* Currently */}
      <div style={{ marginBottom: 14 }}>
        <ProfileLabel>Currently</ProfileLabel>
        {task ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusBadge kind={task.status} mini />
            <span style={{
              fontSize: 12, color: t.ink, fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, minWidth: 0,
            }}>{task.title}</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusBadge kind={agent.status} mini />
          </div>
        )}
      </div>

      {/* Workstation + Brain in 2 cols */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div>
          <ProfileLabel>Workstation</ProfileLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 32, height: 28, borderRadius: 5,
              background: t.panel, border: `1px solid ${t.divider}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                <rect x="1.5" y="1.5" width="13" height="9" rx="1" stroke={t.ink2} strokeWidth="1.1"/>
                <path d="M5 12 h6 M7 10.5 v1.5" stroke={t.ink2} strokeWidth="1.1"/>
              </svg>
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: t.ink, fontWeight: 500, whiteSpace: "nowrap" }}>{agent.workstation.location}</div>
              <div style={{ fontSize: 10.5, color: t.ink3, whiteSpace: "nowrap" }}>{agent.workstation.specs}</div>
            </div>
          </div>
        </div>
        <div>
          <ProfileLabel>Brain</ProfileLabel>
          <BrainChip name={agent.brain} />
        </div>
      </div>

      {/* Repos */}
      <div style={{ marginBottom: 14 }}>
        <ProfileLabel>Repositories</ProfileLabel>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {agent.repos.map(r => <RepoChip key={r.id} name={r.full_name} />)}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingTop: 12,
        borderTop: `1px solid ${t.divider}`,
        fontSize: 11, color: t.ink3,
        flexWrap: "wrap",
      }}>
        <span style={{ whiteSpace: "nowrap" }}>Joined {agent.onboarded}</span>
        <span style={{ color: t.ink4 }}>·</span>
        <span style={{ whiteSpace: "nowrap" }}>Last seen {agent.last_seen}</span>
        <span style={{ flex: 1 }} />
        <Btn variant="ghost" size="sm">Edit profile</Btn>
      </div>
    </div>
  );
};

const ProfileLabel = ({ children }) => {
  const t = useTheme();
  return (
    <div style={{
      fontSize: 10, color: t.ink4, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: 0.6,
      marginBottom: 6,
    }}>{children}</div>
  );
};

const BrainChip = ({ name, size = "md" }) => {
  const t = useTheme();
  const isOpus = name.includes("Opus");
  const isHaiku = name.includes("Haiku");
  const colorKey = isOpus ? "accent" : isHaiku ? "info" : "success";
  const color = t[colorKey];
  const soft = t[colorKey + "Soft"];
  const short = name.replace("Claude ", "");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: size === "sm" ? "3px 8px" : "4px 10px",
      background: soft, color,
      borderRadius: 999,
      fontSize: size === "sm" ? 11 : 12,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      {short}
    </span>
  );
};

Object.assign(window, { SettingsTeamView, ProfileCard, ProfileLabel, BrainChip, SettingsShell });
