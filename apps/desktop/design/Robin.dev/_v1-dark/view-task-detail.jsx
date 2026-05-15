// Popover view: TASK DETAIL with human review actions.
// Drills into the blocked task t_111 — shows full timeline of task_events
// and an inline comment composer / approval buttons.

const EventIcon = ({ type }) => {
  const map = {
    "task.created": { c: "#71717a", svg: <><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1" fill="none"/><path d="M6 4 v4 M4 6 h4" stroke="currentColor" strokeWidth="1"/></> },
    "agent.assigned": { c: "#a78bfa", svg: <><circle cx="6" cy="4" r="1.8" stroke="currentColor" strokeWidth="1" fill="none"/><path d="M2 10 c0-2 2-3 4-3 s4 1 4 3" stroke="currentColor" strokeWidth="1" fill="none"/></> },
    "code.cloned": { c: "#38bdf8", svg: <><rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" fill="none"/><rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" fill="none"/></> },
    "code.committed": { c: "#86efac", svg: <><circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M6 1 v3 M6 8 v3" stroke="currentColor" strokeWidth="1.2"/></> },
    "agent.thinking": { c: "#71717a", svg: <><circle cx="6" cy="6" r="1.5" fill="currentColor"/><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="0.8" fill="none" strokeDasharray="2 1.5"/></> },
    "test.passed": { c: "#4ade80", svg: <><path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></> },
    "test.failed": { c: "#f87171", svg: <><path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></> },
    "agent.blocked": { c: "#fbbf24", svg: <><path d="M6 1 L11 10 H1 Z" stroke="currentColor" strokeWidth="1" fill="rgba(251,191,36,0.15)"/><path d="M6 4 v3" stroke="currentColor" strokeWidth="1"/><circle cx="6" cy="8.5" r="0.5" fill="currentColor"/></> },
    "human.approved": { c: "#4ade80", svg: <><path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></> },
    "pr.opened": { c: "#a78bfa", svg: <><circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1" fill="none"/><circle cx="3" cy="9" r="1.5" stroke="currentColor" strokeWidth="1" fill="none"/><circle cx="9" cy="9" r="1.5" stroke="currentColor" strokeWidth="1" fill="none"/><path d="M3 4.5 v3 M4.5 9 h3" stroke="currentColor" strokeWidth="1"/></> },
  };
  const m = map[type] || map["agent.thinking"];
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 4,
      background: `${m.c}15`, color: m.c,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12">{m.svg}</svg>
    </span>
  );
};

const TimelineEntry = ({ ev, isLast }) => {
  return (
    <div style={{ display: "flex", gap: 9, position: "relative", padding: "6px 14px" }}>
      {!isLast && (
        <div style={{
          position: "absolute",
          left: 14 + 9, top: 24,
          width: 1, bottom: -6,
          background: "#26262b",
        }} />
      )}
      <div style={{ marginTop: 1 }}>
        <EventIcon type={ev.type} />
      </div>
      <div style={{
        flex: 1, minWidth: 0,
        paddingBottom: 6,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 1 }}>
          <span style={{
            fontSize: 10, fontFamily: "'Geist Mono', monospace",
            color: ev.highlight ? "#fbbf24" : "#71717a",
            letterSpacing: 0.3,
          }}>
            {ev.type}
          </span>
          <span style={{ fontSize: 9.5, color: "#52525b", fontFamily: "'Geist Mono', monospace", marginLeft: "auto" }}>
            {ev.at}
          </span>
        </div>
        <div style={{
          fontSize: 11.5,
          color: ev.highlight ? "#fde68a" : "#c4c4c8",
          lineHeight: 1.4,
        }}>
          {ev.text}
          {ev.sha && (
            <span style={{
              fontFamily: "'Geist Mono', monospace", color: "#86efac",
              marginLeft: 6, fontSize: 10.5,
            }}>· {ev.sha}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const TaskDetailView = () => {
  const task = MOCK_TASKS.find(t => t.id === "t_111");
  const agent = MOCK_AGENTS.find(a => a.id === task.agent_id);
  const [comment, setComment] = React.useState("Rotate the staging key first — the prod cert is still pinned in TestFlight.");

  return (
    <PopoverShell label="03 — Task detail · human review">
      {/* breadcrumb-style header back to list */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px",
        borderBottom: "1px solid #1f1f24",
        background: "linear-gradient(180deg, #161619 0%, #131316 100%)",
      }}>
        <IconBtn>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M7 2 L3 6 L7 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconBtn>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot kind="blocked" size={6} />
            <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#fbbf24", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Blocked
            </span>
            <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#52525b" }}>· T_111</span>
            <PriorityChip priority="high" />
          </div>
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: "#f4f4f5",
            marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{task.title}</div>
        </div>
        <IconBtn>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="3" r="1" fill="currentColor"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="7" cy="11" r="1" fill="currentColor"/></svg>
        </IconBtn>
      </div>

      {/* meta strip */}
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid #1f1f24",
        display: "flex", flexDirection: "column", gap: 6,
        background: "#0f0f12",
      }}>
        <MetaRow label="Repo" value={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1 a4.5 4.5 0 0 0 -1.5 8.8 c0.2 0 0.3 -0.15 0.3 -0.3 v-1 c-1.2 0.25 -1.5 -0.5 -1.5 -0.5 c-0.2 -0.5 -0.5 -0.6 -0.5 -0.6 c-0.4 -0.3 0 -0.3 0 -0.3 c0.45 0 0.7 0.45 0.7 0.45 c0.4 0.7 1.1 0.5 1.4 0.4 c0 -0.3 0.15 -0.5 0.3 -0.6 c-1 -0.1 -2 -0.5 -2 -2.2 c0 -0.5 0.17 -0.9 0.45 -1.2 c-0.05 -0.1 -0.2 -0.55 0.05 -1.15 c0 0 0.4 -0.12 1.2 0.45 a4 4 0 0 1 2.2 0 c0.8 -0.57 1.2 -0.45 1.2 -0.45 c0.25 0.6 0.1 1.05 0.05 1.15 c0.3 0.3 0.45 0.7 0.45 1.2 c0 1.7 -1 2.1 -2 2.2 c0.17 0.13 0.3 0.4 0.3 0.8 v1.15 c0 0.15 0.1 0.3 0.3 0.3 a4.5 4.5 0 0 0 -1.5 -8.8" stroke="#a1a1aa" strokeWidth="0.4" fill="#a1a1aa"/></svg>
            <span style={{ fontFamily: "'Geist Mono', monospace" }}>{task.repo}</span>
          </span>
        } />
        <MetaRow label="Branch" value={
          <span style={{ fontFamily: "'Geist Mono', monospace", color: "#fbbf24" }}>
            {task.branch}
          </span>
        } />
        <MetaRow label="Agent" value={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <StatusDot kind={agent.status} size={5} />
            <span style={{ fontFamily: "'Geist Mono', monospace" }}>{agent.name}</span>
            <span style={{ color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>· {agent.vps}</span>
          </span>
        } />
      </div>

      {/* timeline */}
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
        <SectionHeader top right={<LiveBadge />}>
          Timeline · task_events
        </SectionHeader>
        {TASK_111_TIMELINE.map((ev, i) => (
          <TimelineEntry key={i} ev={ev} isLast={i === TASK_111_TIMELINE.length - 1} />
        ))}

        {/* highlighted block ask */}
        <div style={{
          margin: "8px 14px 14px",
          padding: "10px 12px",
          background: "rgba(251,191,36,0.05)",
          border: "1px solid rgba(251,191,36,0.22)",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1 L10 9.5 H1 Z" stroke="#fbbf24" strokeWidth="1" fill="rgba(251,191,36,0.2)"/><path d="M5.5 4 v3" stroke="#fbbf24" strokeWidth="1"/><circle cx="5.5" cy="8" r="0.5" fill="#fbbf24"/></svg>
            <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#fbbf24", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Awaiting human decision
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "#e4e4e7", lineHeight: 1.4 }}>
            robin-03 wants to rotate the APNs signing key in production. This will overwrite
            <span style={{ fontFamily: "'Geist Mono', monospace", color: "#fde68a" }}> keychain.entitlements</span> and trigger a fresh provisioning profile.
          </div>
        </div>
      </div>

      {/* human comment composer */}
      <div style={{
        borderTop: "1px solid #1f1f24",
        padding: "10px 12px",
        background: "#0f0f12",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Your reply
          </span>
          <span style={{ fontSize: 9.5, color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>
            POST /api/tasks/t_111/events
          </span>
        </div>
        <div style={{
          background: "#1a1a1f",
          border: "1px solid #2a2a30",
          borderRadius: 7,
          padding: "8px 10px",
        }}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell robin-03 how to proceed…"
            rows={2}
            style={{
              width: "100%", resize: "none",
              background: "transparent", border: "none", outline: "none",
              color: "#f4f4f5", fontFamily: "inherit", fontSize: 12,
              lineHeight: 1.4,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>
              human.commented
            </span>
            <div style={{ flex: 1 }} />
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <Btn variant="success" full icon={
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 6 L4.5 8.5 L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }>Approve</Btn>
          <Btn variant="danger" full icon={
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M3 3 L8 8 M8 3 L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          }>Reject</Btn>
        </div>
      </div>
    </PopoverShell>
  );
};

const MetaRow = ({ label, value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
    <span style={{
      fontSize: 10, fontFamily: "'Geist Mono', monospace",
      color: "#52525b", textTransform: "uppercase", letterSpacing: 0.4,
      width: 50, flexShrink: 0,
    }}>{label}</span>
    <span style={{ color: "#c4c4c8", fontSize: 11.5 }}>{value}</span>
  </div>
);

Object.assign(window, { TaskDetailView });
