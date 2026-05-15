// Popover view: ACTIVITY — live event feed from task_events (workspace-wide)
// Designed as a denser, log-like view with type chips and live tick.

const ActivityRow = ({ ev }) => {
  const task = MOCK_TASKS.find(t => t.id === ev.task_id);
  const agent = ev.actor.startsWith("agt_") ? MOCK_AGENTS.find(a => a.id === ev.actor) : null;
  return (
    <div style={{
      padding: "8px 14px",
      borderBottom: "1px solid #1a1a1f",
      display: "flex", gap: 9, alignItems: "flex-start",
    }}>
      <span style={{ marginTop: 1 }}>
        <EventIcon type={ev.type} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 1 }}>
          <span style={{
            fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
            color: "#a78bfa", letterSpacing: 0.2,
          }}>{ev.type}</span>
          {agent && (
            <span style={{ fontSize: 9.5, color: "#71717a", fontFamily: "'Geist Mono', monospace" }}>
              · {agent.name}
            </span>
          )}
          {!agent && ev.actor.includes("@") && (
            <span style={{ fontSize: 9.5, color: "#86efac", fontFamily: "'Geist Mono', monospace" }}>
              · you
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 9.5, color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>
            {ev.at}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "#c4c4c8", lineHeight: 1.35, marginBottom: 2 }}>
          {payloadText(ev)}
        </div>
        {task && (
          <div style={{ fontSize: 10, color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>
            <span style={{ color: "#71717a" }}>{task.id.toUpperCase()}</span>
            <span> · </span>
            <span>{task.repo.split("/")[1]}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function payloadText(ev) {
  const p = ev.payload || {};
  switch (ev.type) {
    case "agent.blocked":
      return <span style={{ color: "#fde68a" }}>{p.reason}</span>;
    case "code.committed":
      return <>{p.msg} <span style={{ fontFamily: "'Geist Mono', monospace", color: "#86efac", fontSize: 10.5 }}>· {p.sha}</span></>;
    case "agent.thinking":
      return <span style={{ fontStyle: "italic", color: "#a1a1aa" }}>{p.note}</span>;
    case "test.passed":
      return <>{p.count} tests passed</>;
    case "test.failed":
      return <span style={{ color: "#fca5a5" }}>{p.suite}: {p.failed} failed</span>;
    case "pr.opened":
      return <>Opened PR <span style={{ fontFamily: "'Geist Mono', monospace", color: "#a78bfa" }}>#{p.number}</span></>;
    case "human.approved":
      return <span style={{ color: "#86efac" }}>Approved by founder</span>;
    default:
      return JSON.stringify(p);
  }
}

const ActivityView = () => {
  return (
    <PopoverShell label="04 — Activity (live task_events)">
      <PopoverHeader workspace={MOCK_WORKSPACE} connected agentsOnline={5} agentsTotal={6} />
      <TabStrip
        active="activity"
        tabs={[
          { id: "agents", label: "Agents", count: 6 },
          { id: "sprint", label: "Sprint", count: 5 },
          { id: "activity", label: "Activity" },
        ]}
      />

      {/* filter strip */}
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid #1f1f24",
        background: "#0f0f12",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <FilterChip active>All</FilterChip>
        <FilterChip>Code</FilterChip>
        <FilterChip>Tests</FilterChip>
        <FilterChip>Human</FilterChip>
        <span style={{ flex: 1 }} />
        <LiveBadge>streaming</LiveBadge>
      </div>

      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{
          padding: "6px 14px",
          fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
          color: "#52525b",
          background: "rgba(74,222,128,0.04)",
          borderBottom: "1px solid rgba(74,222,128,0.12)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", animation: "robinBlink 1.6s ease-in-out infinite" }} />
          subscribed: postgres_changes · INSERT on task_events · workspace_id=eq.ws_8f3e
        </div>
        {MOCK_EVENTS.map(ev => <ActivityRow key={ev.id} ev={ev} />)}

        <div style={{
          padding: "16px 14px",
          textAlign: "center",
          color: "#52525b", fontSize: 11,
        }}>
          ↓ scroll for older · 500 max per task
        </div>
      </div>

      <PopoverFooter
        left={<Btn variant="ghost" icon={
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4 h8 M2 6 h8 M2 8 h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        }>Filter</Btn>}
        right={<Btn variant="ghost">Export ↗</Btn>}
      />
    </PopoverShell>
  );
};

const FilterChip = ({ children, active }) => (
  <button style={{
    fontSize: 11, fontFamily: "inherit",
    padding: "3px 9px", borderRadius: 5,
    background: active ? "rgba(255,106,61,0.12)" : "transparent",
    color: active ? "#ff8a5a" : "#a1a1aa",
    border: `1px solid ${active ? "rgba(255,106,61,0.25)" : "rgba(255,255,255,0.06)"}`,
    cursor: "pointer",
  }}>{children}</button>
);

window.ActivityView = ActivityView;
