// PopoverShell — macOS menu bar popover chrome with tail/arrow.
// Renders a rounded dark rectangle with a small triangle pointing up to where
// the menubar icon would live. The popover is fixed width (380px) and the
// caller passes height + children.

const PopoverShell = ({ width = 380, height = 680, tailX = 60, children, label }) => {
  return (
    <div style={{
      width: width + 40,
      height: height + 40,
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      paddingTop: 18,
      paddingLeft: 20,
    }}>
      {/* faux menubar dot to anchor the tail */}
      <div style={{
        position: "absolute",
        top: 0, left: tailX - 8,
        width: 16, height: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <RobinGlyph size={12} muted />
      </div>
      {/* tail */}
      <svg width="22" height="11" viewBox="0 0 22 11" style={{
        position: "absolute",
        top: 17, left: tailX - 11,
        filter: "drop-shadow(0 -1px 0 rgba(255,255,255,0.04))",
      }}>
        <path d="M0 11 L11 0 L22 11 Z" fill="#131316" />
      </svg>
      <div style={{
        width, height,
        background: "#131316",
        borderRadius: 14,
        boxShadow: "0 30px 60px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.08), 0 0 0 1px rgba(0,0,0,0.4)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        color: "#f4f4f5",
        fontFamily: "'Geist', -apple-system, sans-serif",
        fontSize: 13,
        position: "relative",
      }}>
        {children}
      </div>
      {label && (
        <div style={{
          position: "absolute",
          bottom: 0, left: 20,
          color: "rgba(60,50,40,0.55)",
          fontSize: 11, fontFamily: "'Geist', sans-serif",
          letterSpacing: 0.2,
        }}>{label}</div>
      )}
    </div>
  );
};

const RobinGlyph = ({ size = 14, muted = false }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M3 9.5 C3 6.5 5 4 8 4 C10 4 11.5 5 12.5 6.5 L13.5 5.5 L13 8 L11 8 C11 8 10 9 8 9 C6.5 9 5.5 9.5 5 10.5 L3 11.5 Z"
      fill={muted ? "#52525b" : "#ff6a3d"} />
    <circle cx="10.5" cy="6" r="0.7" fill="#0b0b0d" />
  </svg>
);

// Status dot — small colored circle, optional pulse.
const StatusDot = ({ kind, size = 8, pulse }) => {
  const COLORS = {
    busy: "#4ade80",
    idle: "#52525b",
    blocked: "#fbbf24",
    error: "#f87171",
    provisioning: "#38bdf8",
    offline: "#3f3f46",
    in_progress: "#4ade80",
    queued: "#71717a",
    review: "#a78bfa",
    done: "#52525b",
    failed: "#f87171",
    live: "#4ade80",
  };
  const c = COLORS[kind] || "#52525b";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size + 8, height: size + 8, position: "relative",
    }}>
      {pulse && (
        <span style={{
          position: "absolute", inset: 0, margin: "auto",
          width: size + 6, height: size + 6,
          borderRadius: "50%", background: c, opacity: 0.25,
          animation: "robinPulse 1.8s ease-out infinite",
        }} />
      )}
      <span style={{
        width: size, height: size, borderRadius: "50%",
        background: c, boxShadow: pulse ? `0 0 0 1px ${c}55` : "none",
      }} />
    </span>
  );
};

// LiveBadge — "● LIVE" label, used to mark realtime sections vs snapshots.
const LiveBadge = ({ children = "live", muted }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
    textTransform: "uppercase", letterSpacing: 0.7,
    color: muted ? "#71717a" : "#4ade80",
    padding: "2px 6px",
    borderRadius: 4,
    background: muted ? "rgba(113,113,122,0.08)" : "rgba(74,222,128,0.08)",
    border: `1px solid ${muted ? "rgba(113,113,122,0.15)" : "rgba(74,222,128,0.2)"}`,
  }}>
    <span style={{
      width: 5, height: 5, borderRadius: "50%",
      background: muted ? "#71717a" : "#4ade80",
      animation: muted ? "none" : "robinBlink 1.6s ease-in-out infinite",
    }} />
    {children}
  </span>
);

const SnapshotBadge = () => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
    textTransform: "uppercase", letterSpacing: 0.7,
    color: "#a1a1aa",
    padding: "2px 6px",
    borderRadius: 4,
    background: "rgba(161,161,170,0.06)",
    border: "1px solid rgba(161,161,170,0.15)",
  }}>
    <svg width="9" height="9" viewBox="0 0 9 9"><circle cx="4.5" cy="4.5" r="3" stroke="#a1a1aa" strokeWidth="1" fill="none"/><path d="M4.5 2.5 v2 l1.3 1" stroke="#a1a1aa" strokeWidth="1" fill="none" strokeLinecap="round"/></svg>
    snapshot
  </span>
);

// SectionHeader — uppercase eyebrow + optional right-side meta (live badge,
// counts, action). Sticky-able when in a scroll context.
const SectionHeader = ({ children, right, top = false }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: top ? "12px 14px 6px" : "14px 14px 6px",
    fontSize: 10.5, fontFamily: "'Geist Mono', monospace",
    textTransform: "uppercase", letterSpacing: 0.8,
    color: "#71717a",
  }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{children}</span>
    {right}
  </div>
);

// PopoverHeader — workspace switcher + connection state + small icon row
const PopoverHeader = ({ workspace, connected = true, agentsOnline, agentsTotal }) => (
  <div style={{
    display: "flex", alignItems: "center",
    padding: "10px 12px 10px 12px",
    borderBottom: "1px solid #1f1f24",
    gap: 8,
    background: "linear-gradient(180deg, #161619 0%, #131316 100%)",
  }}>
    <div style={{
      width: 26, height: 26, borderRadius: 7,
      background: "linear-gradient(135deg, #ff6a3d, #c64020)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.4)",
    }}>
      <RobinGlyph size={14} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, lineHeight: 1.1 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {workspace.name}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, color: "#71717a" }}>
          <path d="M3 4 L5 6 L7 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#71717a", marginTop: 1, fontFamily: "'Geist Mono', monospace" }}>
        <StatusDot kind={connected ? "busy" : "error"} size={5} pulse={connected} />
        <span>{connected ? "connected" : "offline"} · {agentsOnline}/{agentsTotal} agents</span>
      </div>
    </div>
    <IconBtn>
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M3 4h8M3 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
    </IconBtn>
    <IconBtn>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </IconBtn>
  </div>
);

const IconBtn = ({ children, onClick, active, style }) => (
  <button onClick={onClick} style={{
    width: 26, height: 26, borderRadius: 6,
    background: active ? "rgba(255,255,255,0.07)" : "transparent",
    border: "none", color: "#a1a1aa",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", padding: 0,
    ...style,
  }}>
    {children}
  </button>
);

// Tab strip used inside popover to switch between Agents / Sprint / Activity
const TabStrip = ({ tabs, active, onChange }) => (
  <div style={{
    display: "flex", padding: "0 12px",
    borderBottom: "1px solid #1f1f24",
    gap: 2,
  }}>
    {tabs.map(t => {
      const isActive = t.id === active;
      return (
        <button key={t.id} onClick={() => onChange?.(t.id)} style={{
          background: "transparent", border: "none",
          padding: "9px 10px 10px",
          fontFamily: "inherit", fontSize: 12,
          color: isActive ? "#f4f4f5" : "#71717a",
          cursor: "pointer",
          position: "relative",
          fontWeight: isActive ? 600 : 500,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {t.label}
          {t.count != null && (
            <span style={{
              fontSize: 10, fontFamily: "'Geist Mono', monospace",
              color: isActive ? "#a1a1aa" : "#52525b",
              padding: "1px 5px", borderRadius: 4,
              background: isActive ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
            }}>{t.count}</span>
          )}
          {isActive && (
            <span style={{
              position: "absolute", left: 8, right: 8, bottom: -1, height: 1.5,
              background: "#ff6a3d", borderRadius: 2,
            }}/>
          )}
        </button>
      );
    })}
  </div>
);

// PopoverFooter — bottom action bar with "+ New task" and "Open dashboard"
const PopoverFooter = ({ left, right }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 10px",
    borderTop: "1px solid #1f1f24",
    background: "#101013",
  }}>
    {left}
    <div style={{ flex: 1 }} />
    {right}
  </div>
);

// Primary button (accent) and secondary
const Btn = ({ children, variant = "secondary", onClick, full, icon, style }) => {
  const variants = {
    primary: {
      background: "linear-gradient(180deg, #ff7a4d 0%, #ff6a3d 100%)",
      color: "#1a0a05", border: "1px solid #ff8a5a",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.4)",
      fontWeight: 600,
    },
    secondary: {
      background: "rgba(255,255,255,0.05)",
      color: "#e4e4e7", border: "1px solid rgba(255,255,255,0.08)",
    },
    ghost: {
      background: "transparent", color: "#a1a1aa", border: "1px solid transparent",
    },
    danger: {
      background: "rgba(248,113,113,0.08)", color: "#fca5a5",
      border: "1px solid rgba(248,113,113,0.22)",
    },
    success: {
      background: "rgba(74,222,128,0.1)", color: "#86efac",
      border: "1px solid rgba(74,222,128,0.25)",
    },
  };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      height: 28, padding: "0 12px",
      borderRadius: 7, fontSize: 12, fontFamily: "inherit",
      cursor: "pointer", whiteSpace: "nowrap",
      width: full ? "100%" : "auto",
      ...variants[variant], ...style,
    }}>
      {icon}
      {children}
    </button>
  );
};

// KBD — keyboard hint pill
const Kbd = ({ children, dim }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 16, height: 16, padding: "0 4px",
    fontSize: 10, fontFamily: "'Geist Mono', monospace",
    color: dim ? "#52525b" : "#a1a1aa",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 3,
  }}>{children}</span>
);

// Global animations
if (!document.getElementById("robin-anims")) {
  const s = document.createElement("style");
  s.id = "robin-anims";
  s.textContent = `
    @keyframes robinPulse {
      0% { transform: scale(1); opacity: 0.35; }
      70% { transform: scale(1.9); opacity: 0; }
      100% { transform: scale(1.9); opacity: 0; }
    }
    @keyframes robinBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    @keyframes robinShimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }
    @keyframes robinTick {
      0% { opacity: 0; transform: translateY(2px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .robin-scroll::-webkit-scrollbar { width: 4px; }
    .robin-scroll::-webkit-scrollbar-track { background: transparent; }
    .robin-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  PopoverShell, RobinGlyph, StatusDot, LiveBadge, SnapshotBadge,
  SectionHeader, PopoverHeader, IconBtn, TabStrip, PopoverFooter, Btn, Kbd,
});
