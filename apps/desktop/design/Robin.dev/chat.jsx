// Chat primitives — composer + message bubbles. Used by Robin chat and
// per-agent chat. The composer style mirrors the Robin.dev product chat
// (+ / settings / mic on left, Send button on right).

// ─────────────────────────────────────────────────────────────────────────────
// ChatComposer — the rounded text-input shell

const ChatComposer = ({ placeholder = "Type a message…", value, onChange, onSend, sendLabel = "Send", agentColor }) => {
  const t = useTheme();
  const [v, setV] = React.useState(value || "");
  const display = value !== undefined ? value : v;
  const handle = (nv) => { setV(nv); onChange?.(nv); };

  return (
    <div style={{
      background: "#ffffff",
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      padding: "10px 12px 8px",
      boxShadow: "0 2px 8px rgba(85,65,30,0.05), 0 0 0 1px rgba(255,255,255,0.4) inset",
    }}>
      <textarea
        value={display}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        rows={1}
        onInput={(e) => {
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
        }}
        style={{
          width: "100%", resize: "none",
          background: "transparent", border: "none", outline: "none",
          color: t.ink, fontFamily: "inherit", fontSize: 13.5,
          lineHeight: 1.5, padding: "4px 2px",
          minHeight: 22,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
        <ComposerIcon title="Attach">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2 v10 M2 7 h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </ComposerIcon>
        <ComposerIcon title="Settings">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M7 1.5 v1.5 M7 11 v1.5 M1.5 7 h1.5 M11 7 h1.5 M3 3 l1.1 1.1 M9.9 9.9 l1.1 1.1 M3 11 l1.1 -1.1 M9.9 4.1 l1.1 -1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </ComposerIcon>
        <ComposerIcon title="Voice">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="5.5" y="2" width="3" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M3 7 a4 4 0 0 0 8 0 M7 11 v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </ComposerIcon>
        <div style={{ flex: 1 }} />
        <button onClick={() => { onSend?.(display); handle(""); }} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 30, padding: "0 14px",
          background: agentColor || t.accent,
          color: agentColor ? "#ffffff" : t.accentInk,
          border: "none", borderRadius: 999,
          fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
          cursor: "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(120,40,10,0.18)",
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 1.5 L8 5 L2 8.5 Z" fill="currentColor" />
          </svg>
          {sendLabel}
        </button>
      </div>
    </div>
  );
};

const ComposerIcon = ({ children, title }) => {
  const t = useTheme();
  return (
    <button title={title} style={{
      width: 28, height: 28, borderRadius: 8,
      background: "transparent", border: "none",
      color: t.ink3, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = t.panel}
    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat message bubble. For agent messages we use their hue as accent.

const ChatBubble = ({ role, agent, at, text, you = "Marco" }) => {
  const t = useTheme();
  const isUser = role === "user";
  const isRobin = role === "robin";
  const accent = agent ? `hsl(${agent.hue}, ${t.mode === "light" ? 62 : 50}%, ${t.mode === "light" ? 46 : 60}%)` : t.accent;

  return (
    <div style={{
      display: "flex", gap: 11,
      flexDirection: isUser ? "row-reverse" : "row",
      padding: "8px 16px",
    }}>
      <span style={{ flexShrink: 0, paddingTop: 2 }}>
        {isUser ? (
          <span style={{
            width: 28, height: 28, borderRadius: "50%",
            background: t.ink,
            color: "#ffffff", fontWeight: 600, fontSize: 11,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{you[0]}</span>
        ) : isRobin ? (
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #ff7e58, #d63916)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <RobinGlyph size={13} color="#fff7f3" />
          </span>
        ) : (
          <Avatar agent={agent} size="sm" showStatus={false} />
        )}
      </span>
      <div style={{ maxWidth: "78%", minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4,
          justifyContent: isUser ? "flex-end" : "flex-start",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>
            {isUser ? you : isRobin ? "Robin.dev" : agent?.name.split(" ")[0]}
          </span>
          <span style={{ fontSize: 10.5, color: t.ink3, whiteSpace: "nowrap" }}>{at}</span>
        </div>
        <div style={{
          padding: "9px 12px",
          fontSize: 13, color: isUser ? "#ffffff" : t.ink,
          background: isUser ? t.ink : (isRobin ? t.accentSoft : t.panel),
          borderRadius: 14,
          borderTopLeftRadius: isUser ? 14 : 4,
          borderTopRightRadius: isUser ? 4 : 14,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
        }}>
          {text}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ChatComposer, ChatBubble });
