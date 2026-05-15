// Expanded window — when user pops the popover open to a full window.
// Wider layout (1100x720) with three columns:
//   left   : agents column
//   center : active task / log
//   right  : sprint queue
// macOS-style window chrome (traffic lights), inset, dark.

const ExpandedWindow = () => {
  const activeTask = MOCK_TASKS.find(t => t.id === "t_104");
  const activeAgent = MOCK_AGENTS.find(a => a.id === activeTask.agent_id);

  return (
    <div style={{
      width: 1140, height: 740,
      padding: 18,
      position: "relative",
    }}>
      <div style={{
        width: "100%", height: "100%",
        background: "#131316",
        borderRadius: 12,
        boxShadow: "0 30px 60px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.08), 0 0 0 1px rgba(0,0,0,0.4)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        color: "#f4f4f5",
        fontFamily: "'Geist', -apple-system, sans-serif",
        fontSize: 13,
      }}>
        {/* macOS title bar */}
        <div style={{
          height: 38,
          display: "flex", alignItems: "center",
          padding: "0 14px",
          borderBottom: "1px solid #1f1f24",
          background: "linear-gradient(180deg, #1a1a1e 0%, #131316 100%)",
          gap: 10,
        }}>
          <div style={{ display: "flex", gap: 7 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 14 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              background: "linear-gradient(135deg, #ff6a3d, #c64020)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <RobinGlyph size={10} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Robin</span>
            <span style={{ fontSize: 11, color: "#71717a" }}>·</span>
            <span style={{ fontSize: 12, color: "#a1a1aa" }}>{MOCK_WORKSPACE.name}</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LiveBadge>connected</LiveBadge>
            <span style={{ fontSize: 10.5, color: "#71717a", fontFamily: "'Geist Mono', monospace" }}>
              {MOCK_WORKSPACE.member}
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: "#26262b", margin: "0 4px" }} />
          <Btn variant="ghost" icon={
            <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5.5 3.5 v2 l1.3 1" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg>
          }>History</Btn>
          <Btn variant="primary" icon={
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1 v9 M1 5.5 h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          }>New task</Btn>
        </div>

        {/* 3-column body */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr 320px", minHeight: 0 }}>
          {/* ── LEFT: Agents */}
          <div style={{
            borderRight: "1px solid #1f1f24",
            display: "flex", flexDirection: "column",
            minHeight: 0,
          }}>
            <SectionHeader top right={<LiveBadge />}>Agents · 6</SectionHeader>
            <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {MOCK_AGENTS.map(a => {
                const t = MOCK_TASKS.find(x => x.id === a.current_task_id);
                const isActive = a.id === activeAgent.id;
                return (
                  <div key={a.id} style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #1a1a1f",
                    background: isActive ? "rgba(255,106,61,0.06)" : "transparent",
                    borderLeft: `2px solid ${isActive ? "#ff6a3d" : "transparent"}`,
                    cursor: "pointer",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <StatusDot kind={a.status} size={7} pulse={a.status === "busy"} />
                      <span style={{ fontSize: 12, fontFamily: "'Geist Mono', monospace", fontWeight: 600, color: a.status === "offline" ? "#71717a" : "#f4f4f5" }}>
                        {a.name}
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 10, color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>
                        {a.last_heartbeat !== "—" && `↑${a.last_heartbeat}`}
                      </span>
                    </div>
                    {t ? (
                      <div style={{
                        fontSize: 11, color: "#a1a1aa", lineHeight: 1.35,
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      }}>{t.title}</div>
                    ) : (
                      <div style={{ fontSize: 10.5, color: "#52525b", fontStyle: "italic" }}>
                        {STATUS_LABEL[a.status]}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                      {a.repos.map(r => (
                        <span key={r.id} style={{
                          fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
                          color: "#71717a",
                          padding: "1px 4px",
                          background: "rgba(255,255,255,0.04)",
                          borderRadius: 3,
                        }}>{r.full_name.split("/")[1]}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* footer with utilization */}
            <div style={{
              padding: "10px 14px",
              borderTop: "1px solid #1f1f24",
              background: "#0f0f12",
              fontSize: 10.5, color: "#71717a",
              fontFamily: "'Geist Mono', monospace",
              display: "flex", justifyContent: "space-between",
            }}>
              <span>fleet · 5/6 online</span>
              <span style={{ color: "#86efac" }}>83% util</span>
            </div>
          </div>

          {/* ── CENTER: Active task panel */}
          <div style={{
            display: "flex", flexDirection: "column",
            minHeight: 0,
          }}>
            <div style={{
              padding: "14px 18px 12px",
              borderBottom: "1px solid #1f1f24",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <StatusDot kind="in_progress" size={7} pulse />
                <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#86efac", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  In progress
                </span>
                <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#52525b" }}>· T_104</span>
                <PriorityChip priority="high" />
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, color: "#a78bfa", fontFamily: "'Geist Mono', monospace", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <svg width="9" height="9" viewBox="0 0 9 9"><circle cx="1.5" cy="1.5" r="1" stroke="currentColor" strokeWidth="0.8" fill="none"/><circle cx="1.5" cy="7.5" r="1" stroke="currentColor" strokeWidth="0.8" fill="none"/><circle cx="7.5" cy="7.5" r="1" stroke="currentColor" strokeWidth="0.8" fill="none"/></svg>
                  PR #412
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#f4f4f5", marginBottom: 8, lineHeight: 1.25 }}>
                {activeTask.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#a1a1aa" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <StatusDot kind="busy" size={5} />
                  <span style={{ fontFamily: "'Geist Mono', monospace" }}>{activeAgent.name}</span>
                </span>
                <span style={{ color: "#3f3f46" }}>·</span>
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{activeTask.repo}</span>
                <span style={{ color: "#3f3f46" }}>·</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", color: "#86efac", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2 1 v7 M2 3 a1.5 1.5 0 0 0 3 0 v-1" stroke="currentColor" strokeWidth="0.8" fill="none"/></svg>
                  {activeTask.branch}
                </span>
              </div>
            </div>

            {/* live log */}
            <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 18px 14px" }}>
              <div style={{
                fontSize: 10, fontFamily: "'Geist Mono', monospace",
                color: "#71717a", textTransform: "uppercase", letterSpacing: 0.6,
                padding: "10px 0 8px", display: "flex", alignItems: "center", gap: 8,
              }}>
                <span>Live log · task_events</span>
                <LiveBadge>streaming</LiveBadge>
                <span style={{ flex: 1 }} />
                <span style={{ textTransform: "none", letterSpacing: 0, color: "#52525b" }}>
                  filter: task_id=eq.t_104
                </span>
              </div>

              {[
                { type: "code.committed", at: "34s ago", text: "wire backoff helper into webhook handler", sha: "a3f12c" },
                { type: "test.passed", at: "2m ago", text: "14 tests passed (billing/webhooks.test.ts)" },
                { type: "agent.thinking", at: "3m ago", text: "Reading stripe-node retry semantics — comparing to current implementation" },
                { type: "code.committed", at: "6m ago", text: "extract retry config into module", sha: "881e44" },
                { type: "code.committed", at: "9m ago", text: "scaffold backoff helper", sha: "12bfa9" },
                { type: "agent.assigned", at: "11m ago", text: "Assigned by sprint start" },
                { type: "task.created", at: "23m ago", text: "Created from sprint planning" },
              ].map((ev, i, arr) => (
                <TimelineEntryDense key={i} ev={ev} isLast={i === arr.length - 1} />
              ))}
            </div>

            {/* command bar */}
            <div style={{
              borderTop: "1px solid #1f1f24",
              padding: "10px 14px",
              background: "#0f0f12",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                flex: 1,
                background: "#1a1a1f",
                border: "1px solid #2a2a30",
                borderRadius: 7,
                padding: "7px 10px",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 12, color: "#71717a",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6 a4 4 0 1 0 8 0 a4 4 0 0 0 -8 0 M9 9 L11 11" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg>
                <span>Comment on this task, or type / for actions…</span>
                <span style={{ flex: 1 }} />
                <Kbd>⌘K</Kbd>
              </div>
              <Btn variant="success" icon={
                <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 6 L4.5 8.5 L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }>Approve PR</Btn>
            </div>
          </div>

          {/* ── RIGHT: Sprint queue */}
          <div style={{
            borderLeft: "1px solid #1f1f24",
            display: "flex", flexDirection: "column",
            minHeight: 0,
            background: "#101013",
          }}>
            <div style={{
              padding: "12px 14px 10px",
              borderBottom: "1px solid #1f1f24",
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#f4f4f5" }}>Sprint May 15</span>
                <span style={{ fontSize: 10, color: "#71717a", fontFamily: "'Geist Mono', monospace" }}>· 3d 4h</span>
              </div>
              <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", gap: 2 }}>
                <div style={{ flex: 1, background: "#52525b" }} />
                <div style={{ flex: 2, background: "#4ade80" }} />
                <div style={{ flex: 0.4, background: "#fbbf24" }} />
                <div style={{ flex: 0.4, background: "#a78bfa" }} />
                <div style={{ flex: 1, background: "#2a2a30" }} />
              </div>
            </div>

            <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
              <SectionHeader top right={<span style={{ color: "#fbbf24", fontFamily: "'Geist Mono', monospace", fontSize: 10 }}>!</span>}>
                <span style={{ color: "#fbbf24" }}>Blocked · 1</span>
              </SectionHeader>
              {MOCK_TASKS.filter(t => t.status === "blocked").map(t =>
                <CompactTaskRow key={t.id} task={t} />)}

              <SectionHeader>In progress · 2</SectionHeader>
              {MOCK_TASKS.filter(t => t.status === "in_progress").map(t =>
                <CompactTaskRow key={t.id} task={t} active={t.id === "t_104"} />)}

              <SectionHeader>Review · 1</SectionHeader>
              {MOCK_TASKS.filter(t => t.status === "review").map(t =>
                <CompactTaskRow key={t.id} task={t} />)}

              <SectionHeader>Queued · 1</SectionHeader>
              {MOCK_TASKS.filter(t => t.status === "queued").map(t =>
                <CompactTaskRow key={t.id} task={t} />)}

              <SectionHeader>Done · 1</SectionHeader>
              {MOCK_TASKS.filter(t => t.status === "done").map(t =>
                <CompactTaskRow key={t.id} task={t} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CompactTaskRow = ({ task, active }) => (
  <div style={{
    padding: "8px 14px",
    borderBottom: "1px solid #1a1a1f",
    background: active ? "rgba(255,106,61,0.06)" : "transparent",
    borderLeft: `2px solid ${active ? "#ff6a3d" : "transparent"}`,
    cursor: "pointer",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
      <StatusDot kind={task.status} size={6} />
      <span style={{ fontSize: 9.5, fontFamily: "'Geist Mono', monospace", color: "#52525b" }}>
        {task.id.toUpperCase()}
      </span>
      <PriorityChip priority={task.priority} />
      {task.pr_number && (
        <span style={{ marginLeft: "auto", fontSize: 9.5, fontFamily: "'Geist Mono', monospace", color: "#a78bfa" }}>
          #{task.pr_number}
        </span>
      )}
    </div>
    <div style={{
      fontSize: 11.5, color: task.status === "done" ? "#71717a" : "#e4e4e7",
      textDecoration: task.status === "done" ? "line-through" : "none",
      lineHeight: 1.35,
      overflow: "hidden", textOverflow: "ellipsis",
      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
    }}>{task.title}</div>
    <div style={{ fontSize: 10, color: "#71717a", marginTop: 3, fontFamily: "'Geist Mono', monospace" }}>
      {task.repo.split("/")[1]}
      {task.agent_id && <span> · {MOCK_AGENTS.find(a => a.id === task.agent_id).name}</span>}
    </div>
  </div>
);

const TimelineEntryDense = ({ ev, isLast }) => (
  <div style={{ display: "flex", gap: 10, position: "relative", paddingBottom: 10 }}>
    {!isLast && (
      <div style={{
        position: "absolute",
        left: 9, top: 22, width: 1, bottom: -4,
        background: "#26262b",
      }} />
    )}
    <div style={{ marginTop: 1, flexShrink: 0 }}>
      <EventIcon type={ev.type} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#a78bfa", letterSpacing: 0.2 }}>
          {ev.type}
        </span>
        <span style={{ fontSize: 9.5, color: "#52525b", fontFamily: "'Geist Mono', monospace", marginLeft: "auto" }}>
          {ev.at}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#c4c4c8", lineHeight: 1.4, marginTop: 2 }}>
        {ev.text}
        {ev.sha && <span style={{ fontFamily: "'Geist Mono', monospace", color: "#86efac", marginLeft: 6, fontSize: 10.5 }}>· {ev.sha}</span>}
      </div>
    </div>
  </div>
);

window.ExpandedWindow = ExpandedWindow;
