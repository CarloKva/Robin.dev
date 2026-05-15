// Popover chrome v3 — team-first, less mono, more breathing room.
// Reads tokens from useTheme(). Avatar/PersonLine live in avatar.jsx.

// ─────────────────────────────────────────────────────────────────────────────
// Brand glyph (R for Robin, monoline)

const RobinGlyph = ({ size = 14, color }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M4 13 V3 H9 a3 3 0 0 1 0 6 H4.5 M8 9 L12.5 13"
      stroke={color || "#d63916"} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Status taxonomy — unified across agents and tasks

const STATUS_CONFIG = {
  working:     { dotKey: "success", label: "Working" },
  focused:     { dotKey: "info",    label: "Focused" },
  needs_input: { dotKey: "warning", label: "Needs you" },
  available:   { dotKey: "neutral", label: "Available" },
  onboarding:  { dotKey: "info",    label: "Onboarding" },
  off:         { dotKey: "neutral", label: "Off" },
  // task-only
  in_progress: { dotKey: "success", label: "In progress" },
  blocked:     { dotKey: "warning", label: "Needs you" },
  review:      { dotKey: "info",    label: "In review" },
  queued:      { dotKey: "neutral", label: "Queued" },
  done:        { dotKey: "neutral", label: "Done" },
};
window.STATUS_CONFIG = STATUS_CONFIG;

const StatusDot = ({ kind, size = 8, pulse }) => {
  const t = useTheme();
  const cfg = STATUS_CONFIG[kind] || { dotKey: "neutral" };
  const c = t[cfg.dotKey] || t.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size + 6, height: size + 6, position: "relative", flexShrink: 0,
    }}>
      {pulse && (
        <span style={{
          position: "absolute", inset: 0, margin: "auto",
          width: size + 4, height: size + 4, borderRadius: "50%",
          background: c, opacity: 0.3,
          animation: "robinPulse 1.8s ease-out infinite",
        }} />
      )}
      <span style={{
        width: size, height: size, borderRadius: "50%", background: c,
      }} />
    </span>
  );
};

const StatusBadge = ({ kind, children, mini }) => {
  const t = useTheme();
  const cfg = STATUS_CONFIG[kind] || { dotKey: "neutral", label: kind };
  const c = t[cfg.dotKey];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: mini ? 10 : 11,
      fontWeight: 500,
      color: c,
      padding: mini ? "1px 7px" : "3px 8px",
      borderRadius: 999,
      background: t[cfg.dotKey + "Soft"] || t.neutralSoft,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
      {children || cfg.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Live indicator — subtle, single source per popover (in header)

const LiveDot = ({ size = 6 }) => {
  const t = useTheme();
  return (
    <span style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: t.success,
      }} />
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: t.success, animation: "robinPulse 2s ease-out infinite",
      }} />
    </span>
  );
};

const LiveLabel = ({ children = "live" }) => {
  const t = useTheme();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10.5, color: t.ink3, fontWeight: 500,
    }}>
      <LiveDot size={5} />
      {children}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Popover shell — menubar tail + drop shadow

const PopoverShell = ({ width = 380, height = 680, tailX = 60, children, label, sublabel }) => {
  const t = useTheme();
  return (
    <div style={{
      width: width + 40, height: height + 50,
      position: "relative", paddingTop: 18, paddingLeft: 20, boxSizing: "border-box",
    }}>
      {/* menubar icon */}
      <div style={{
        position: "absolute", top: -2, left: tailX - 10,
        width: 20, height: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <RobinGlyph size={13} color={t.mode === "light" ? "#1a1612" : "#bdb5a1"} />
      </div>
      {/* tail */}
      <svg width="22" height="11" viewBox="0 0 22 11" style={{
        position: "absolute", top: 17, left: tailX - 11, zIndex: 1,
      }}>
        <path d="M0 11 L11 0 L22 11 Z" fill={t.popover} stroke={t.border} strokeWidth="0.5"/>
        <path d="M1 11 L11 1 L21 11" stroke={t.border} strokeWidth="0.5" fill="none" />
      </svg>
      <div style={{
        width, height,
        background: t.popover,
        borderRadius: 16,
        boxShadow: `0 30px 60px ${t.shadowStrong}, 0 1px 0 ${t.popoverEdge} inset, 0 0 0 1px ${t.border}`,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        color: t.ink,
        fontFamily: "'Geist', -apple-system, sans-serif",
        fontSize: 13,
        position: "relative",
      }}>
        {children}
      </div>
      {(label || sublabel) && (
        <div style={{
          position: "absolute", bottom: 4, left: 20,
          color: "rgba(60,50,40,0.55)",
          fontSize: 11, fontFamily: "'Geist', sans-serif",
          display: "flex", gap: 8, alignItems: "baseline",
        }}>
          {label && <span style={{ fontWeight: 600 }}>{label}</span>}
          {sublabel && <span>{sublabel}</span>}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section header — sentence case, no mono. Optional right slot.

const SectionHeader = ({ children, right, top, accent }) => {
  const t = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: top ? "14px 16px 8px" : "18px 16px 8px",
      fontSize: 11, fontWeight: 600,
      color: accent || t.ink3,
      letterSpacing: 0.1,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>{children}</span>
      {right}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Popover header — team avatar stack + workspace name + settings.
// Replaces the Robin logo with a live roster of engineers who are on the clock.

const PopoverHeader = ({ workspace, connected = true, onSettings }) => {
  const t = useTheme();
  const onClock = (window.MOCK_AGENTS || []).filter(a => a.status !== "off");
  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "12px 14px",
      borderBottom: `1px solid ${t.divider}`,
      gap: 12,
    }}>
      <AvatarRoster agents={onClock} max={5} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: t.ink, lineHeight: 1.15,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{workspace.name}</div>
        <div style={{ fontSize: 11, color: t.ink3, marginTop: 1, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
          {connected ? <LiveDot size={5} /> : <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.danger }} />}
          <span>{connected ? `${onClock.length} on the clock` : "offline"}</span>
        </div>
      </div>
      <IconBtn onClick={onSettings} title="Settings">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M8 1.5 v2 M8 12.5 v2 M1.5 8 h2 M12.5 8 h2 M3.5 3.5 l1.4 1.4 M11.1 11.1 l1.4 1.4 M3.5 12.5 l1.4 -1.4 M11.1 4.9 l1.4 -1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </IconBtn>
    </div>
  );
};

// Avatar roster — overlapping stack with overflow chip.
// Status dot rendered larger and offset so it reads as the team's live mood.
const AvatarRoster = ({ agents, max = 5 }) => {
  const t = useTheme();
  const shown = agents.slice(0, max);
  const overflow = agents.length - max;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      {shown.map((a, i) => (
        <span key={a.id} style={{
          marginLeft: i === 0 ? 0 : -8,
          position: "relative",
          zIndex: shown.length - i,
        }}>
          <span style={{
            display: "inline-block",
            borderRadius: "50%",
            boxShadow: `0 0 0 1.5px ${t.popover}`,
          }}>
            <Avatar agent={a} size="xs" />
          </span>
        </span>
      ))}
      {overflow > 0 && (
        <span style={{
          marginLeft: -8,
          width: 22, height: 22, borderRadius: "50%",
          background: t.panel, color: t.ink2,
          border: `1.5px solid ${t.popover}`,
          fontSize: 9.5, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", zIndex: 0,
        }}>+{overflow}</span>
      )}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Icon button

const IconBtn = ({ children, onClick, active, title, style }) => {
  const t = useTheme();
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 8,
      background: active ? t.hover : "transparent",
      border: "none", color: active ? t.ink : t.ink2,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", padding: 0,
      transition: "background 0.12s, color 0.12s",
      flexShrink: 0,
      ...style,
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.hover; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab strip — sentence-case labels, small dot for urgent

const TabStrip = ({ tabs, active, onChange }) => {
  const t = useTheme();
  return (
    <div style={{
      display: "flex", padding: "0 12px",
      borderBottom: `1px solid ${t.divider}`,
      gap: 2,
    }}>
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <button key={tab.id} onClick={() => onChange?.(tab.id)} style={{
            background: "transparent", border: "none",
            padding: "10px 10px 12px",
            fontFamily: "inherit", fontSize: 12.5,
            color: isActive ? t.ink : t.ink2,
            cursor: "pointer", position: "relative",
            fontWeight: isActive ? 600 : 500,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600, lineHeight: 1,
                color: tab.urgent ? t.warning : (isActive ? t.ink2 : t.ink3),
                padding: tab.urgent ? "2px 6px" : "1px 5px",
                borderRadius: 999,
                background: tab.urgent ? t.warningSoft : (isActive ? t.hover : t.panel),
              }}>{tab.count}</span>
            )}
            {isActive && (
              <span style={{
                position: "absolute", left: 8, right: 8, bottom: -1, height: 2,
                background: t.accent, borderRadius: 2,
              }}/>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Footer

const PopoverFooter = ({ left, right }) => {
  const t = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "10px 12px",
      borderTop: `1px solid ${t.divider}`,
      background: t.panel,
    }}>
      {left}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Button

const Btn = ({ children, variant = "secondary", onClick, full, icon, size = "md", style }) => {
  const t = useTheme();
  const variants = {
    primary: {
      background: t.accent, color: t.accentInk,
      border: "1px solid transparent",
      boxShadow: t.mode === "light"
        ? "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(120,40,10,0.18)"
        : "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.4)",
      fontWeight: 600,
    },
    secondary: {
      background: t.mode === "light" ? "#ffffff" : "rgba(255,255,255,0.05)",
      color: t.ink, border: `1px solid ${t.border}`,
      boxShadow: t.mode === "light" ? "0 1px 0 rgba(85,65,30,0.04)" : "none",
    },
    ghost: {
      background: "transparent", color: t.ink2, border: "1px solid transparent",
    },
    danger: {
      background: t.dangerSoft, color: t.danger,
      border: `1px solid transparent`,
    },
    success: {
      background: t.success, color: "#ffffff",
      border: `1px solid transparent`,
      boxShadow: t.mode === "light" ? "inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(20,80,40,0.15)" : "none",
      fontWeight: 600,
    },
    successSoft: {
      background: t.successSoft, color: t.success,
      border: "1px solid transparent",
    },
    warning: {
      background: t.warningSoft, color: t.warning,
      border: "1px solid transparent",
    },
  };
  const sizes = {
    sm: { height: 26, padding: "0 10px", fontSize: 11.5, gap: 5 },
    md: { height: 30, padding: "0 13px", fontSize: 12.5, gap: 6 },
    lg: { height: 36, padding: "0 16px", fontSize: 13.5, gap: 7 },
  };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: 8, fontFamily: "inherit",
      cursor: "pointer", whiteSpace: "nowrap",
      width: full ? "100%" : "auto",
      transition: "transform 0.06s, background 0.12s, filter 0.12s",
      ...sizes[size], ...variants[variant], ...style,
    }}
    onMouseDown={(e) => e.currentTarget.style.transform = "translateY(0.5px)"}
    onMouseUp={(e) => e.currentTarget.style.transform = "translateY(0)"}
    onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
      {icon}
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Kbd

const Kbd = ({ children }) => {
  const t = useTheme();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 18, height: 18, padding: "0 5px",
      fontSize: 10.5, fontFamily: "'Geist Mono', monospace",
      color: t.ink2,
      background: t.mode === "light" ? "#ffffff" : "rgba(255,255,255,0.05)",
      border: `1px solid ${t.border}`,
      borderRadius: 4,
      boxShadow: t.mode === "light" ? "0 1px 0 rgba(85,65,30,0.06)" : "none",
    }}>{children}</span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Repo chip — sentence case in light, mono kept for clarity

const RepoChip = ({ name, size = "sm" }) => {
  const t = useTheme();
  const short = name.includes("/") ? name.split("/")[1] : name;
  const sizes = {
    sm: { fs: 11, py: 2, px: 7 },
    md: { fs: 12, py: 3, px: 8 },
  };
  const s = sizes[size];
  return (
    <span style={{
      fontSize: s.fs, fontFamily: "'Geist Mono', monospace",
      color: t.ink2,
      padding: `${s.py}px ${s.px}px`,
      background: t.panel,
      borderRadius: 5,
      display: "inline-flex", alignItems: "center", gap: 5,
      maxWidth: 180,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      lineHeight: 1.3,
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
        <path d="M2 1.5 h5 a1 1 0 0 1 1 1 v6 a1 1 0 0 1 -1 1 H3 a1 1 0 0 1 -1 -1 z M3 7 h5"
          stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{short}</span>
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Priority — tiny dot (not chip) for less visual noise

const PriorityDot = ({ priority }) => {
  const t = useTheme();
  const map = {
    high: t.danger,
    med: t.warning,
    low: t.ink4,
  };
  const c = map[priority] || t.ink4;
  return (
    <span title={`P${priority === "high" ? 0 : priority === "med" ? 1 : 2}`} style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, color: t.ink3, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Branch tag — small, mono, for branch refs

const BranchTag = ({ name }) => {
  const t = useTheme();
  if (!name) return null;
  return (
    <span style={{
      fontSize: 10.5, fontFamily: "'Geist Mono', monospace",
      color: t.ink2,
      display: "inline-flex", alignItems: "center", gap: 4,
      whiteSpace: "nowrap",
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="3" cy="2" r="1" stroke="currentColor" strokeWidth="0.9"/>
        <circle cx="3" cy="8" r="1" stroke="currentColor" strokeWidth="0.9"/>
        <circle cx="7" cy="5" r="1" stroke="currentColor" strokeWidth="0.9"/>
        <path d="M3 3 v4 M3.8 7 c1 0 2.5 -0.5 2.5 -2" stroke="currentColor" strokeWidth="0.9" fill="none"/>
      </svg>
      {name}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Global animations

if (!document.getElementById("robin-anims")) {
  const s = document.createElement("style");
  s.id = "robin-anims";
  s.textContent = `
    @keyframes robinPulse {
      0% { transform: scale(1); opacity: 0.4; }
      80% { transform: scale(2.2); opacity: 0; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    @keyframes robinBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes robinShimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .robin-scroll::-webkit-scrollbar { width: 6px; }
    .robin-scroll::-webkit-scrollbar-track { background: transparent; }
    .robin-scroll::-webkit-scrollbar-thumb { background: rgba(85,65,30,0.15); border-radius: 3px; }
    .robin-scroll::-webkit-scrollbar-thumb:hover { background: rgba(85,65,30,0.28); }
    .robin-row { transition: background 0.12s; }
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  RobinGlyph, StatusDot, StatusBadge, LiveDot, LiveLabel,
  PopoverShell, SectionHeader, PopoverHeader, IconBtn, TabStrip,
  PopoverFooter, Btn, Kbd, RepoChip, PriorityDot, BranchTag,
});
