// Popover view: AGENTS overview (default landing state)
// Sections:
//  - Header (workspace + connection)
//  - Tabs (Agents / Sprint / Activity)
//  - "Workers" group with online agents, current task, repo, live tick
//  - "Idle / Offline" group collapsed-ish
//  - Footer with Quick task + Open in browser

const AgentRow = ({ agent }) => {
  const task = MOCK_TASKS.find(t => t.id === agent.current_task_id);
  const showProgress = agent.status === "busy" || agent.status === "blocked" || agent.status === "provisioning";
  const tickColor = {
    busy: "#4ade80",
    blocked: "#fbbf24",
    provisioning: "#38bdf8",
    error: "#f87171",
    idle: "#52525b",
    offline: "#3f3f46",
  }[agent.status];

  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid #1a1a1f",
      display: "flex", alignItems: "flex-start", gap: 10,
      position: "relative",
    }}>
      {/* avatar — status dot only; agent name lives in the row */}
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: "#1c1c20",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, position: "relative", marginTop: 1,
        opacity: agent.status === "offline" ? 0.55 : 1,
      }}>
        <StatusDot kind={agent.status} size={8} pulse={agent.status === "busy"} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{
              fontSize: 12.5, fontWeight: 600,
              color: agent.status === "offline" ? "#71717a" : "#f4f4f5",
              fontFamily: "'Geist Mono', monospace",
              flexShrink: 0,
            }}>
              {agent.name}
            </span>
            <span style={{
              fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#52525b",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>
              {agent.vps}
            </span>
          </div>
          <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "#52525b", flexShrink: 0 }}>
            {agent.last_heartbeat !== "—" && `↑${agent.last_heartbeat}`}
          </span>
        </div>

        {/* repos — org prefix dropped (workspace is implicit), single-line ellipsis */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          marginBottom: task ? 6 : 0,
          minWidth: 0, overflow: "hidden",
        }}>
          {agent.repos.slice(0, 2).map((r, i) => (
            <span key={r.id} style={{
              fontSize: 10.5, fontFamily: "'Geist Mono', monospace",
              color: "#a1a1aa",
              padding: "1px 5px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 3,
              maxWidth: 130,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flexShrink: 1, minWidth: 0,
            }}>
              {r.full_name.split("/")[1]}
            </span>
          ))}
          {agent.repos.length > 2 && (
            <span style={{
              fontSize: 10, fontFamily: "'Geist Mono', monospace",
              color: "#52525b", flexShrink: 0,
            }}>+{agent.repos.length - 2}</span>
          )}
        </div>

        {/* task */}
        {task && (
          <div style={{
            background: agent.status === "blocked" ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.025)",
            border: `1px solid ${agent.status === "blocked" ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)"}`,
            borderRadius: 6,
            padding: "7px 8px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, minWidth: 0 }}>
              <span style={{
                fontSize: 9, fontFamily: "'Geist Mono', monospace",
                color: "#52525b", letterSpacing: 0.3, flexShrink: 0,
              }}>{task.id.toUpperCase()}</span>
              {task.branch !== "—" && (
                <span style={{
                  fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
                  color: agent.status === "blocked" ? "#fbbf24" : "#86efac",
                  display: "inline-flex", alignItems: "center", gap: 3,
                  minWidth: 0, overflow: "hidden",
                }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" style={{ flexShrink: 0 }}><path d="M2 1 v6 M2 3 a1.5 1.5 0 0 0 3 0 v-1" stroke="currentColor" strokeWidth="0.8" fill="none"/></svg>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.branch}</span>
                </span>
              )}
            </div>
            <div style={{
              fontSize: 11.5, color: "#e4e4e7",
              lineHeight: 1.35,
              overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {task.title}
            </div>
            {/* progress / activity line */}
            {showProgress && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                {agent.status === "busy" && (
                  <div style={{
                    flex: 1, height: 2, background: "rgba(255,255,255,0.04)", borderRadius: 1, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      background: `linear-gradient(90deg, transparent, ${tickColor}, transparent)`,
                      backgroundSize: "200px 100%",
                      animation: "robinShimmer 1.6s linear infinite",
                      width: "100%",
                    }} />
                  </div>
                )}
                {agent.status === "blocked" && (
                  <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <svg width="9" height="9" viewBox="0 0 9 9"><path d="M4.5 1 L8.5 8 H0.5 Z" stroke="#fbbf24" strokeWidth="0.8" fill="rgba(251,191,36,0.15)"/><path d="M4.5 3.5 v2" stroke="#fbbf24" strokeWidth="0.8"/><circle cx="4.5" cy="6.5" r="0.4" fill="#fbbf24"/></svg>
                    Needs your review
                  </span>
                )}
                {agent.status === "provisioning" && (
                  <span style={{ fontSize: 10, color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.2px solid #38bdf8", borderRightColor: "transparent", animation: "spin 0.9s linear infinite", display: "inline-block" }} />
                    Cloning repo · 2/6
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* idle empty state */}
        {!task && agent.status === "idle" && (
          <div style={{ fontSize: 10.5, color: "#52525b", fontStyle: "italic", paddingTop: 2 }}>
            Idle · awaiting next task
          </div>
        )}
        {!task && agent.status === "provisioning" && (
          <div style={{ fontSize: 10.5, color: "#38bdf8", paddingTop: 2, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.2px solid #38bdf8", borderRightColor: "transparent", animation: "spin 0.9s linear infinite", display: "inline-block" }} />
            Provisioning VPS · step 3/6
          </div>
        )}
      </div>
    </div>
  );
};

const AgentsView = () => {
  const online = MOCK_AGENTS.filter(a => a.status !== "offline");
  const offline = MOCK_AGENTS.filter(a => a.status === "offline");
  return (
    <PopoverShell label="01 — Agents (default landing)">
      <PopoverHeader workspace={MOCK_WORKSPACE} connected agentsOnline={5} agentsTotal={6} />
      <TabStrip
        active="agents"
        tabs={[
          { id: "agents", label: "Agents", count: 6 },
          { id: "sprint", label: "Sprint", count: 5 },
          { id: "activity", label: "Activity" },
        ]}
      />
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
        <SectionHeader top right={<LiveBadge />}>
          Workers · {online.length}
        </SectionHeader>
        {online.map(a => <AgentRow key={a.id} agent={a} />)}

        {offline.length > 0 && (
          <>
            <SectionHeader>Offline · {offline.length}</SectionHeader>
            {offline.map(a => <AgentRow key={a.id} agent={a} />)}
          </>
        )}
      </div>
      <PopoverFooter
        left={
          <Btn variant="primary" icon={
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1 v9 M1 5.5 h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          }>New task</Btn>
        }
        right={
          <>
            <Btn variant="ghost" icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 8 L8 4 M5 4 h3 v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="1.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
            }>Dashboard</Btn>
          </>
        }
      />
    </PopoverShell>
  );
};

window.AgentsView = AgentsView;
