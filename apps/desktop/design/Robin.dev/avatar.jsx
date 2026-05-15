// Avatar — the team primitive. Initials in a colored circle, plus presence dot.
// Size scale: xs 22 · sm 28 · md 36 · lg 48 · xl 72

const Avatar = ({ agent, size = "md", showStatus = true, ring }) => {
  const t = useTheme();
  if (!agent) return null;

  const SIZES = {
    xs: { box: 22, text: 9.5, dot: 7, dotOffset: -1, ringPx: 1.5 },
    sm: { box: 28, text: 11,  dot: 8, dotOffset: -1, ringPx: 1.5 },
    md: { box: 36, text: 13.5,dot: 10, dotOffset: -1, ringPx: 2 },
    lg: { box: 48, text: 17,  dot: 12, dotOffset: 0,  ringPx: 2 },
    xl: { box: 72, text: 26,  dot: 16, dotOffset: 2,  ringPx: 2.5 },
  };
  const s = SIZES[size];
  const h = agent.hue;

  // Soft → vivid gradient, distinct per agent. Light theme uses brighter saturation,
  // dark theme deeper.
  const isDark = t.mode === "dark";
  const g1 = `hsl(${h}, ${isDark ? 50 : 62}%, ${isDark ? 48 : 56}%)`;
  const g2 = `hsl(${h + 22}, ${isDark ? 55 : 70}%, ${isDark ? 38 : 46}%)`;
  const inkColor = "#ffffff";

  const statusColors = {
    working:     t.success,
    focused:     t.info,
    needs_input: t.warning,
    available:   t.ink4,
    onboarding:  t.info,
    off:         t.ink4,
  };
  const presence = statusColors[agent.status] || t.ink4;
  const pulse = agent.status === "working";

  return (
    <span style={{
      position: "relative",
      width: s.box, height: s.box,
      display: "inline-flex", flexShrink: 0,
    }}>
      <span style={{
        width: s.box, height: s.box,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${g1}, ${g2})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: inkColor,
        fontSize: s.text, fontWeight: 600,
        letterSpacing: 0.2,
        boxShadow: ring
          ? `0 0 0 ${s.ringPx + 1}px ${t.popover}, 0 0 0 ${s.ringPx + 2.5}px ${presence}`
          : `inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,${isDark ? 0.4 : 0.12})`,
        textShadow: "0 1px 0 rgba(0,0,0,0.1)",
        fontFamily: "'Geist', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}>
        {agent.initials}
        {agent.photo && (
          <img
            src={agent.photo}
            alt={agent.name}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", borderRadius: "50%",
              filter: `saturate(0.95) contrast(1.02)`,
            }}
          />
        )}
      </span>
      {showStatus && (
        <span style={{
          position: "absolute",
          bottom: s.dotOffset, right: s.dotOffset,
          width: s.dot, height: s.dot,
          borderRadius: "50%",
          background: presence,
          border: `${s.ringPx}px solid ${t.popover}`,
          boxSizing: "content-box",
        }}>
          {pulse && (
            <span style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: presence,
              animation: "robinPulse 1.8s ease-out infinite",
              opacity: 0.45,
            }} />
          )}
          {agent.status === "onboarding" && (
            <span style={{
              position: "absolute", inset: -2,
              borderRadius: "50%",
              border: `${s.ringPx}px solid ${presence}`,
              borderRightColor: "transparent",
              animation: "spin 1.2s linear infinite",
            }} />
          )}
          {agent.status === "off" && (
            <span style={{
              position: "absolute", inset: 0,
              borderRadius: "50%",
              background: "transparent",
              boxShadow: `inset 0 0 0 1.5px ${t.popover}`,
            }} />
          )}
        </span>
      )}
    </span>
  );
};

// Avatar stack — for repo collaborators / multi-agent contexts
const AvatarStack = ({ agents, size = "sm", max = 4 }) => {
  const t = useTheme();
  const shown = agents.slice(0, max);
  const overflow = agents.length - max;
  const SIZE = { xs: 22, sm: 28, md: 36, lg: 48 }[size];
  return (
    <span style={{ display: "inline-flex" }}>
      {shown.map((a, i) => (
        <span key={a.id} style={{ marginLeft: i === 0 ? 0 : -SIZE * 0.3 }}>
          <Avatar agent={a} size={size} showStatus={false} />
        </span>
      ))}
      {overflow > 0 && (
        <span style={{
          width: SIZE, height: SIZE, borderRadius: "50%",
          background: t.panel,
          color: t.ink2,
          fontSize: SIZE * 0.34, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginLeft: -SIZE * 0.3,
          border: `1.5px solid ${t.popover}`,
          fontFamily: "'Geist', sans-serif",
        }}>+{overflow}</span>
      )}
    </span>
  );
};

// Person line — Avatar + name + role/status. The atomic "who" element.
const PersonLine = ({ agent, secondary, size = "sm", nameSize = 12.5 }) => {
  const t = useTheme();
  if (!agent) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <Avatar agent={agent} size={size} />
      <span style={{ minWidth: 0, overflow: "hidden" }}>
        <span style={{
          display: "block",
          fontSize: nameSize, fontWeight: 600, color: t.ink,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: 1.2,
        }}>
          {agent.name}
        </span>
        {secondary !== undefined && (
          <span style={{
            display: "block",
            fontSize: nameSize - 2.5, color: t.ink3,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            lineHeight: 1.2, marginTop: 1,
          }}>
            {secondary}
          </span>
        )}
      </span>
    </span>
  );
};

Object.assign(window, { Avatar, AvatarStack, PersonLine });
