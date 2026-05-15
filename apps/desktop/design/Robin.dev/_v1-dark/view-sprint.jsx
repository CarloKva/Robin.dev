// Popover view: SPRINT — synthetic queue with task statuses
// Shows tasks grouped by status: Blocked (top, needs attention) → In progress → Queued → Review → Done

const TaskRow = ({ task, compact }) => {
  const agent = task.agent_id ? MOCK_AGENTS.find(a => a.id === task.agent_id) : null;
  const statusColor = {
    in_progress: "#4ade80",
    blocked: "#fbbf24",
    queued: "#71717a",
    review: "#a78bfa",
    done: "#52525b",
    failed: "#f87171",
  }[task.status];
  const isBlocked = task.status === "blocked";
  const isDone = task.status === "done";
  const isReview = task.status === "review";

  return (
    <div style={{
      padding: "9px 14px 9px 14px",
      borderBottom: "1px solid #1a1a1f",
      display: "flex", alignItems: "flex-start", gap: 10,
      background: isBlocked ? "rgba(251,191,36,0.025)" : "transparent",
      position: "relative",
      cursor: "pointer",
    }}>
      <div style={{ paddingTop: 3, flexShrink: 0 }}>
        <StatusDot kind={task.status} size={8} pulse={task.status === "in_progress"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 9.5, fontFamily: "'Geist Mono', monospace", color: "#52525b" }}>
            {task.id.toUpperCase()}
          </span>
          <PriorityChip priority={task.priority} />
          {task.pr_number && (
            <span style={{ fontSize: 9.5, fontFamily: "'Geist Mono', monospace", color: "#a78bfa",
              display: "inline-flex", alignItems: "center", gap: 3 }}>
              <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="2" cy="2" r="1.2" fill="none" stroke="currentColor" strokeWidth="0.8"/><circle cx="2" cy="6" r="1.2" fill="none" stroke="currentColor" strokeWidth="0.8"/><circle cx="6" cy="6" r="1.2" fill="none" stroke="currentColor" strokeWidth="0.8"/><path d="M2 3 v2 M3 6 h2" stroke="currentColor" strokeWidth="0.8"/></svg>
              #{task.pr_number}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 12, color: isDone ? "#71717a" : "#f4f4f5",
          fontWeight: isBlocked ? 500 : 400,
          textDecoration: isDone ? "line-through" : "none",
          lineHeight: 1.35,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          marginBottom: 4,
        }}>
          {task.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, fontFamily: "'Geist Mono', monospace",
            color: "#71717a",
          }}>{task.repo.split("/")[1]}</span>
          {agent && (
            <>
              <span style={{ color: "#3f3f46" }}>·</span>
              <span style={{ fontSize: 10, color: "#71717a", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <StatusDot kind={agent.status} size={5} />
                {agent.name}
              </span>
            </>
          )}
          {isBlocked && (
            <>
              <span style={{ flex: 1 }} />
              <span style={{
                fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
                color: "#fbbf24", textTransform: "uppercase", letterSpacing: 0.4,
              }}>review →</span>
            </>
          )}
          {isReview && (
            <>
              <span style={{ flex: 1 }} />
              <span style={{
                fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
                color: "#a78bfa", textTransform: "uppercase", letterSpacing: 0.4,
              }}>PR ready</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const PriorityChip = ({ priority }) => {
  const styles = {
    high: { color: "#f87171", label: "P0" },
    med: { color: "#fbbf24", label: "P1" },
    low: { color: "#71717a", label: "P2" },
  }[priority] || { color: "#71717a", label: "—" };
  return (
    <span style={{
      fontSize: 9, fontFamily: "'Geist Mono', monospace",
      color: styles.color,
      padding: "0 4px", borderRadius: 3,
      border: `1px solid ${styles.color}33`,
      background: `${styles.color}11`,
      fontWeight: 600,
    }}>{styles.label}</span>
  );
};

const SprintView = () => {
  const blocked = MOCK_TASKS.filter(t => t.status === "blocked");
  const inProgress = MOCK_TASKS.filter(t => t.status === "in_progress");
  const review = MOCK_TASKS.filter(t => t.status === "review");
  const queued = MOCK_TASKS.filter(t => t.status === "queued");
  const done = MOCK_TASKS.filter(t => t.status === "done");

  return (
    <PopoverShell label="02 — Sprint queue">
      <PopoverHeader workspace={MOCK_WORKSPACE} connected agentsOnline={5} agentsTotal={6} />
      <TabStrip
        active="sprint"
        tabs={[
          { id: "agents", label: "Agents", count: 6 },
          { id: "sprint", label: "Sprint", count: 5 },
          { id: "activity", label: "Activity" },
        ]}
      />

      {/* Sprint progress meta-bar */}
      <div style={{
        padding: "12px 14px",
        borderBottom: "1px solid #1a1a1f",
        background: "#0f0f12",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#f4f4f5" }}>Sprint · May 12 → 19</div>
            <div style={{ fontSize: 10.5, color: "#71717a", marginTop: 1, fontFamily: "'Geist Mono', monospace" }}>
              SP_MAY15 · 3d 4h remaining
            </div>
          </div>
          <SnapshotBadge />
        </div>
        {/* segmented progress bar */}
        <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", gap: 2 }}>
          <div style={{ flex: 1, background: "#52525b" }} title="done" />
          <div style={{ flex: 2, background: "#4ade80", animation: "robinBlink 2.4s ease-in-out infinite" }} title="in progress" />
          <div style={{ flex: 0.4, background: "#fbbf24" }} title="blocked" />
          <div style={{ flex: 0.4, background: "#a78bfa" }} title="review" />
          <div style={{ flex: 1, background: "#2a2a30" }} title="queued" />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 10, color: "#71717a", fontFamily: "'Geist Mono', monospace" }}>
          <span><span style={{ color: "#86efac" }}>●</span> {inProgress.length} active</span>
          <span><span style={{ color: "#fbbf24" }}>●</span> {blocked.length} blocked</span>
          <span><span style={{ color: "#a78bfa" }}>●</span> {review.length} review</span>
          <span><span style={{ color: "#71717a" }}>●</span> {queued.length} queued</span>
          <span style={{ marginLeft: "auto" }}>{done.length}/{MOCK_TASKS.length} done</span>
        </div>
      </div>

      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {blocked.length > 0 && (
          <>
            <SectionHeader right={<LiveBadge />}>
              <span style={{ color: "#fbbf24" }}>Blocked · {blocked.length}</span>
            </SectionHeader>
            {blocked.map(t => <TaskRow key={t.id} task={t} />)}
          </>
        )}
        <SectionHeader right={<LiveBadge />}>In progress · {inProgress.length}</SectionHeader>
        {inProgress.map(t => <TaskRow key={t.id} task={t} />)}

        <SectionHeader>In review · {review.length}</SectionHeader>
        {review.map(t => <TaskRow key={t.id} task={t} />)}

        <SectionHeader>Queued · {queued.length}</SectionHeader>
        {queued.map(t => <TaskRow key={t.id} task={t} />)}

        <SectionHeader>Done · {done.length}</SectionHeader>
        {done.map(t => <TaskRow key={t.id} task={t} />)}
      </div>
      <PopoverFooter
        left={
          <Btn variant="primary" icon={
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1 v9 M1 5.5 h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          }>New task</Btn>
        }
        right={<Btn variant="ghost">Open sprint ↗</Btn>}
      />
    </PopoverShell>
  );
};

Object.assign(window, { SprintView, TaskRow, PriorityChip });
