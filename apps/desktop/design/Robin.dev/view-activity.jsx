// Popover view: HISTORY — git-style commit log of all team work.

const HistoryView = () => {
  const t = useTheme();

  // Group by day for sticky-ish headers
  const groups = [];
  for (const h of MOCK_HISTORY) {
    const day = h.at.includes("yesterday") ? "Yesterday"
              : h.at.includes("hour") || h.at.includes("minute") || h.at.includes("second") ? "Today"
              : "Earlier";
    let g = groups.find(x => x.day === day);
    if (!g) { g = { day, items: [] }; groups.push(g); }
    g.items.push(h);
  }

  return (
    <PopoverShell label="05 · History" sublabel="git-style log of team commits">
      <PopoverHeader workspace={MOCK_WORKSPACE} connected />
      <div style={{ padding: "14px 16px 6px" }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: t.ink, letterSpacing: -0.2 }}>
          History
        </div>
        <div style={{ fontSize: 12.5, color: t.ink3, marginTop: 4, lineHeight: 1.45 }}>
          Every commit your team has pushed.
        </div>
      </div>
      <TabStrip
        active="history"
        tabs={[
          { id: "inbox", label: "Inbox", count: MOCK_INBOX.filter(n => n.unread).length },
          { id: "wip", label: "In progress", count: MOCK_TASKS.filter(x => x.status === "in_progress").length },
          { id: "history", label: "History" },
        ]}
      />

      <div style={{
        padding: "8px 14px",
        borderBottom: `1px solid ${t.divider}`,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <Filter active>All</Filter>
        <Filter>Merges</Filter>
        <Filter>By engineer</Filter>
        <span style={{ flex: 1 }} />
        <LiveLabel>streaming</LiveLabel>
      </div>

      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {groups.map(g => (
          <React.Fragment key={g.day}>
            <SectionHeader top={g === groups[0]}>{g.day}</SectionHeader>
            {g.items.map((h, i) => (
              <HistoryRow key={h.id} h={h} isLast={i === g.items.length - 1} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </PopoverShell>
  );
};

const HistoryRow = ({ h, isLast }) => {
  const t = useTheme();
  const agent = getAgent(h.agent_id);
  const lane = `hsl(${agent.hue}, 60%, 50%)`;
  return (
    <div style={{
      display: "flex", gap: 12, position: "relative",
      padding: "8px 16px",
    }}>
      {/* lane line */}
      <div style={{
        position: "absolute", left: 16 + 14, top: 0,
        width: 2, bottom: isLast ? "50%" : 0,
        background: t.divider,
      }} />
      {/* commit dot */}
      <span style={{
        width: 30, display: "flex", justifyContent: "center",
        position: "relative", zIndex: 1, paddingTop: 5,
      }}>
        <span style={{
          width: h.merge ? 10 : 8, height: h.merge ? 10 : 8,
          borderRadius: "50%",
          background: lane,
          border: `2px solid ${t.popover}`,
          boxShadow: h.merge ? `0 0 0 2px ${t.successBorder}` : "none",
        }} />
      </span>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <Avatar agent={agent} size="xs" showStatus={false} />
          <span style={{ fontSize: 12, color: t.ink, fontWeight: 600, whiteSpace: "nowrap" }}>
            {agent.name.split(" ")[0]}
          </span>
          <span style={{ fontSize: 10.5, fontFamily: "'Geist Mono', monospace", color: t.ink3, whiteSpace: "nowrap" }}>
            {h.sha}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, color: t.ink4, whiteSpace: "nowrap" }}>{h.at}</span>
        </div>
        <div style={{
          fontSize: 12.5, color: t.ink2, lineHeight: 1.4, marginTop: 3,
          fontWeight: h.merge ? 600 : 400,
        }}>
          {h.message}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 10.5, fontFamily: "'Geist Mono', monospace", color: t.ink3 }}>
            {h.repo}
          </span>
          <span style={{ color: t.ink4 }}>·</span>
          <BranchTag name={h.branch} />
        </div>
      </div>
    </div>
  );
};

const Filter = ({ children, active }) => {
  const t = useTheme();
  return (
    <button style={{
      fontSize: 11.5, fontFamily: "inherit",
      padding: "4px 11px", borderRadius: 999,
      background: active ? t.accentSoft : "transparent",
      color: active ? t.accent : t.ink2,
      border: "none", cursor: "pointer",
      fontWeight: active ? 600 : 500,
      whiteSpace: "nowrap",
    }}>{children}</button>
  );
};

Object.assign(window, { HistoryView });
