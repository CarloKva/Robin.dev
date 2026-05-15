// Popover view: TASK DETAIL — read-only. Timeline of what the engineer did,
// quoted thoughts. No composer.

const EventIcon = ({ type, size = 22 }) => {
  const t = useTheme();
  const map = {
    "task.created":   { c: t.ink3,    glyph: <path d="M6 3 v6 M3 6 h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/> },
    "agent.assigned": { c: t.info,    glyph: <><circle cx="6" cy="4.5" r="1.6" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M2.5 10 c0 -2 1.7 -3 3.5 -3 s3.5 1 3.5 3" stroke="currentColor" strokeWidth="1.2" fill="none"/></> },
    "code.cloned":    { c: t.info,    glyph: <><rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none"/><rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none"/></> },
    "code.committed": { c: t.success, glyph: <><circle cx="6" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M6 1 v3 M6 8 v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
    "agent.thinking": { c: t.ink3,    glyph: <><circle cx="3" cy="6" r="0.9" fill="currentColor"/><circle cx="6" cy="6" r="0.9" fill="currentColor"/><circle cx="9" cy="6" r="0.9" fill="currentColor"/></> },
    "test.passed":    { c: t.success, glyph: <path d="M2.5 6.2 L5 8.5 L9.5 3.5" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/> },
    "test.failed":    { c: t.danger,  glyph: <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/> },
    "pr.opened":      { c: t.info,    glyph: <><circle cx="3" cy="3" r="1.3" stroke="currentColor" strokeWidth="1.1" fill="none"/><circle cx="3" cy="9" r="1.3" stroke="currentColor" strokeWidth="1.1" fill="none"/><circle cx="9" cy="9" r="1.3" stroke="currentColor" strokeWidth="1.1" fill="none"/></> },
  };
  const m = map[type] || map["agent.thinking"];
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: `${m.c}1c`, color: m.c,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12">{m.glyph}</svg>
    </span>
  );
};

const TimelineEntry = ({ ev, actor, isLast }) => {
  const t = useTheme();
  return (
    <div style={{ display: "flex", gap: 12, position: "relative", padding: "4px 16px" }}>
      {!isLast && (
        <div style={{
          position: "absolute", left: 16 + 11, top: 26,
          width: 1, bottom: -4, background: t.divider,
        }} />
      )}
      <EventIcon type={ev.type} />
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 11.5, color: t.ink2, fontWeight: 500, whiteSpace: "nowrap" }}>{actor}</span>
          <span style={{ fontSize: 10.5, color: t.ink4, marginLeft: "auto", whiteSpace: "nowrap" }}>{ev.at}</span>
        </div>
        <div style={{
          fontSize: 12.5, color: t.ink2, lineHeight: 1.45, marginTop: 2,
          fontStyle: ev.type === "agent.thinking" ? "italic" : "normal",
        }}>
          {ev.text}
          {ev.sha && (
            <span style={{ fontFamily: "'Geist Mono', monospace", color: t.success, marginLeft: 6, fontSize: 11 }}>
              · {ev.sha}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const TaskDetailView = () => {
  const t = useTheme();
  const task = getTask("t_111");
  const agent = getAgent(task.agent_id);

  return (
    <PopoverShell label="03 · Task detail" sublabel="read-only — open the chat to talk to the engineer">
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 12px",
        borderBottom: `1px solid ${t.divider}`,
      }}>
        <IconBtn>
          <svg width="13" height="13" viewBox="0 0 13 13"><path d="M8 2 L4 6.5 L8 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconBtn>
        <span style={{ fontSize: 12.5, color: t.ink2, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          In progress
        </span>
        <span style={{ fontSize: 10.5, color: t.ink3, padding: "2px 8px", background: t.panel, borderRadius: 6, whiteSpace: "nowrap" }}>
          read-only
        </span>
      </div>

      {/* hero */}
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${t.divider}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <Avatar agent={agent} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, lineHeight: 1.2, whiteSpace: "nowrap" }}>
              {agent.name}
            </div>
            <div style={{ fontSize: 11.5, color: t.ink3, marginTop: 2, whiteSpace: "nowrap" }}>
              {agent.role}
            </div>
            <div style={{ marginTop: 6 }}>
              <StatusBadge kind="in_progress" mini>Working</StatusBadge>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, lineHeight: 1.35, marginBottom: 8 }}>
          {task.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <RepoChip name={task.repo} />
          <BranchTag name={task.branch} />
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: t.ink3, whiteSpace: "nowrap" }}>
            started {task.started}
          </span>
        </div>
      </div>

      {/* current activity callout */}
      <div style={{
        margin: "14px 16px 6px",
        padding: "12px 14px",
        background: t.panel,
        borderRadius: 12,
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <LiveDot size={6} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: t.ink3, fontWeight: 600, marginBottom: 3 }}>
            Right now
          </div>
          <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.45 }}>
            {task.current_activity}
          </div>
        </div>
      </div>

      {/* timeline */}
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <SectionHeader top right={<LiveLabel />}>
          What's happened
        </SectionHeader>
        {TASK_111_TIMELINE.map((ev, i) => {
          let actor = ev.actor;
          if (ev.actor && ev.actor.startsWith("agt_")) actor = getAgent(ev.actor)?.name.split(" ")[0] || ev.actor;
          else if (ev.actor === "system") actor = "System";
          return (
            <TimelineEntry key={i} ev={ev} actor={actor} isLast={i === TASK_111_TIMELINE.length - 1} />
          );
        })}
      </div>

      <PopoverFooter
        left={<span style={{ fontSize: 11.5, color: t.ink3, paddingLeft: 4 }}>
          To talk to {agent.name.split(" ")[0]}, open the expanded view.
        </span>}
        right={<Btn variant="ghost" size="sm">Open chat ↗</Btn>}
      />
    </PopoverShell>
  );
};

Object.assign(window, { TaskDetailView, EventIcon, TimelineEntry });
