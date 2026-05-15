// Expanded window — chat directly with the engineer.
// Left: team. Center: agent chat (Claude Code instance). Right: leaderboard.

const ExpandedWindow = () => {
  const t = useTheme();
  const activeAgent = getAgent("agt_01");

  return (
    <WindowShell title="Robin.dev" subtitle={MOCK_WORKSPACE.name} width={1100} height={680}
      toolbar={<LiveLabel>everyone live</LiveLabel>}>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "240px 1fr 280px", minHeight: 0 }}>
        {/* LEFT: Team */}
        <TeamRail activeId={activeAgent.id} />

        {/* CENTER: Chat with agent */}
        <AgentChatPanel agent={activeAgent} />

        {/* RIGHT: Leaderboard */}
        <LeaderboardRail />
      </div>
    </WindowShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Team rail

const TeamRail = ({ activeId }) => {
  const t = useTheme();
  return (
    <div style={{
      borderRight: `1px solid ${t.divider}`,
      display: "flex", flexDirection: "column", minHeight: 0,
      background: t.popover,
    }}>
      <SectionHeader top>Your team</SectionHeader>
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {MOCK_AGENTS.map(a => {
          const taskOn = a.current_task_id ? getTask(a.current_task_id) : null;
          const isActive = a.id === activeId;
          return (
            <div key={a.id} className="robin-row" style={{
              padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 10,
              background: isActive ? t.accentSoft : "transparent",
              borderLeft: `2px solid ${isActive ? t.accent : "transparent"}`,
              cursor: "pointer",
            }}>
              <Avatar agent={a} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 10.5, color: t.ink3, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {taskOn ? `on ${taskOn.repo.split("/")[1]}` : STATUS_CONFIG[a.status]?.label.toLowerCase()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Agent chat panel

const AgentChatPanel = ({ agent }) => {
  const t = useTheme();
  const agentColor = `hsl(${agent.hue}, ${t.mode === "light" ? 62 : 50}%, ${t.mode === "light" ? 46 : 60}%)`;
  const task = agent.current_task_id ? getTask(agent.current_task_id) : null;

  // open PRs across all the inbox + task — quick mock
  const openPRs = [
    ...MOCK_INBOX.filter(n => n.agent_id === agent.id && n.pr && !n.pr.merged).map(n => ({ pr: n.pr, title: n.task_title })),
    ...(task && task.pr_number ? [{ pr: { number: task.pr_number }, title: task.title, current: true }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: t.popover }}>
      {/* hero — agent intro in first person */}
      <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${t.divider}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <Avatar agent={agent} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.ink, lineHeight: 1.25, letterSpacing: -0.1 }}>
              <span>Hi, I'm </span>
              <span style={{ color: agentColor }}>{agent.name}</span>
              <span>.</span>
            </div>
            <div style={{ fontSize: 12.5, color: t.ink3, marginTop: 4, lineHeight: 1.45 }}>
              I'm a <b style={{ color: t.ink2, fontWeight: 600 }}>{agent.role}</b> on the {MOCK_WORKSPACE.name} team.{" "}
              {agent.bio}
            </div>
            <div style={{ fontSize: 12.5, color: t.ink2, marginTop: 6, lineHeight: 1.5 }}>
              {task
                ? <>Right now I'm wrapping up <b style={{ color: t.ink }}>{task.title.toLowerCase()}</b>. Happy to talk about that, or anything else in {agent.repos.map(r => r.full_name.split("/")[1]).join(", ")}.</>
                : <>I'm free right now — ask me anything or send work my way.</>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {agent.specialty.map(s => (
                <span key={s} style={{
                  fontSize: 10.5, color: agentColor, fontWeight: 500,
                  padding: "2px 9px", borderRadius: 999,
                  background: `hsl(${agent.hue}, 60%, 95%)`,
                  whiteSpace: "nowrap",
                }}>{s}</span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <StatusBadge kind={agent.status} mini />
            <BrainChip name={agent.brain} size="sm" />
          </div>
        </div>

        {/* minimal PRs line */}
        {openPRs.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 14, fontSize: 11.5, color: t.ink3, flexWrap: "wrap",
          }}>
            <span>Open PRs:</span>
            {openPRs.map((p, i) => (
              <a key={i} href="#" style={{
                color: p.current ? t.success : t.info,
                textDecoration: "none", fontWeight: 600,
                whiteSpace: "nowrap",
              }}>
                #{p.pr.number}{i < openPRs.length - 1 ? "," : ""}
              </a>
            ))}
            <span style={{ color: t.ink4 }}>·</span>
            <span style={{ whiteSpace: "nowrap" }}>{agent.workstation.location} · {agent.workstation.specs}</span>
          </div>
        )}
      </div>

      {/* Activity tabs */}
      <div style={{
        display: "flex", alignItems: "center", padding: "0 20px",
        borderBottom: `1px solid ${t.divider}`, gap: 2,
      }}>
        <ChatTab active>Chat</ChatTab>
        <ChatTab>Activity</ChatTab>
        <ChatTab>Logs</ChatTab>
        <span style={{ flex: 1 }} />
        <LiveLabel>streaming</LiveLabel>
      </div>

      {/* Chat thread */}
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
        {ARIA_CHAT.map((m, i) => (
          <ChatBubble key={i} role={m.role} agent={agent} at={m.at} text={m.text} you={MOCK_WORKSPACE.member} />
        ))}
        <div style={{ padding: "8px 16px", display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 10.5, color: t.ink4, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <LiveDot size={4} />
            {agent.name.split(" ")[0]} is online — replies usually within a minute
          </span>
        </div>
      </div>

      {/* Composer */}
      <div style={{
        padding: "12px 16px",
        background: t.popover,
        borderTop: `1px solid ${t.divider}`,
      }}>
        <ChatComposer placeholder={`Talk to ${agent.name.split(" ")[0]}…`} sendLabel="Send" agentColor={agentColor} />
        <div style={{
          marginTop: 6, fontSize: 10.5, color: t.ink4, textAlign: "center",
        }}>
          You're talking directly to {agent.name.split(" ")[0]}'s Claude Code instance on {agent.workstation.label}
        </div>
      </div>
    </div>
  );
};

const ChatTab = ({ children, active }) => {
  const t = useTheme();
  return (
    <button style={{
      background: "transparent", border: "none",
      padding: "9px 10px 11px",
      fontFamily: "inherit", fontSize: 12.5,
      color: active ? t.ink : t.ink3,
      cursor: "pointer", position: "relative",
      fontWeight: active ? 600 : 500,
    }}>
      {children}
      {active && (
        <span style={{
          position: "absolute", left: 8, right: 8, bottom: -1, height: 2,
          background: t.accent, borderRadius: 2,
        }}/>
      )}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard rail — gamified. Top 3 on a podium, rest as achievement rows.

const LeaderboardRail = () => {
  const t = useTheme();
  const sorted = [...MOCK_LEADERBOARD].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  // podium order on screen: silver (2nd), gold (1st), bronze (3rd)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div style={{
      borderLeft: `1px solid ${t.divider}`,
      display: "flex", flexDirection: "column", minHeight: 0,
      background: t.panel,
    }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${t.divider}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TrophyIcon />
          <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, letterSpacing: -0.1 }}>
            Top this week
          </div>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, color: t.ink3, fontWeight: 500 }}>resets Mon</span>
        </div>
      </div>

      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 12px 12px" }}>
        {/* Podium */}
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 4,
          padding: "14px 4px 0",
        }}>
          {podiumOrder.map((row, i) => {
            const rank = sorted.indexOf(row) + 1;
            return <PodiumSlot key={row.agent_id} row={row} rank={rank} />;
          })}
        </div>

        {/* Rest */}
        <div style={{ marginTop: 16 }}>
          {rest.map(row => {
            const agent = getAgent(row.agent_id);
            const rank = sorted.indexOf(row) + 1;
            return (
              <div key={row.agent_id} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "5px 8px",
                borderRadius: 7,
                marginBottom: 2,
              }}>
                <span style={{
                  fontSize: 10, color: t.ink3, fontWeight: 700,
                  width: 14, textAlign: "center", flexShrink: 0,
                  fontFamily: "'Geist Mono', monospace",
                }}>#{rank}</span>
                <Avatar agent={agent} size="xs" showStatus={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>
                    {agent.name.split(" ")[0]}
                  </div>
                  <div style={{ display: "inline-flex", gap: 7, marginTop: 1 }}>
                    <Achievement icon="commit" value={row.commits} />
                    <Achievement icon="pr" value={row.prs_merged} />
                    <Achievement icon="ship" value={row.tasks_shipped} />
                  </div>
                </div>
                <span style={{ fontSize: 11.5, color: t.ink2, fontWeight: 600, fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap" }}>
                  {row.score}<span style={{ color: t.ink4, fontWeight: 500, fontSize: 9, marginLeft: 2 }}>XP</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Team milestones */}
        <div style={{
          marginTop: 16, padding: "14px 14px",
          background: t.popover, borderRadius: 12,
        }}>
          <div style={{ fontSize: 10.5, color: t.ink3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Team this week
          </div>
          <Milestone label="Commits" value="132" icon="commit" />
          <Milestone label="PRs merged" value="10" icon="pr" />
          <Milestone label="Tasks shipped" value="12" icon="ship" />
          <Milestone label="Lines changed" value="3.4 K" icon="lines" />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Podium slot — pedestal + avatar floating + medal

const PodiumSlot = ({ row, rank }) => {
  const t = useTheme();
  const agent = getAgent(row.agent_id);
  const medals = {
    1: { color: "#f7d774", deep: "#d6a83a", height: 92, label: "1st" },
    2: { color: "#d8d3c5", deep: "#a8a395", height: 68, label: "2nd" },
    3: { color: "#d6b48a", deep: "#a8855a", height: 52, label: "3rd" },
  };
  const m = medals[rank];
  const size = rank === 1 ? "lg" : "md";
  const avatarFloat = rank === 1 ? -12 : -10;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
      {/* avatar + name floats above pedestal */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 4, marginBottom: avatarFloat,
        position: "relative", zIndex: 2,
      }}>
        <span style={{ position: "relative" }}>
          <Avatar agent={agent} size={size} showStatus={false} />
          {/* medal badge */}
          <span style={{
            position: "absolute", bottom: -2, right: -2,
            width: rank === 1 ? 18 : 15, height: rank === 1 ? 18 : 15,
            borderRadius: "50%",
            background: `linear-gradient(180deg, ${m.color}, ${m.deep})`,
            border: `2px solid ${t.panel}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#3a2c10",
            fontSize: rank === 1 ? 9 : 8, fontWeight: 800,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.15)",
          }}>{rank}</span>
        </span>
        <div style={{
          fontSize: rank === 1 ? 12 : 11, fontWeight: 600, color: t.ink,
          whiteSpace: "nowrap", maxWidth: 90,
          overflow: "hidden", textOverflow: "ellipsis",
        }}>{agent.name.split(" ")[0]}</div>
      </div>

      {/* pedestal — XP lives inside */}
      <div style={{
        width: "100%", height: m.height,
        background: `linear-gradient(180deg, ${m.color}, ${m.deep})`,
        borderTopLeftRadius: 8, borderTopRightRadius: 8,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 8px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 1,
        color: "rgba(50,30,5,0.95)",
      }}>
        <div style={{
          fontSize: rank === 1 ? 18 : 14,
          fontWeight: 800,
          fontFamily: "'Geist Mono', monospace",
          letterSpacing: -0.3,
          lineHeight: 1,
        }}>
          {row.score}
        </div>
        <div style={{
          fontSize: 8.5, fontWeight: 700,
          letterSpacing: 0.6,
          color: "rgba(50,30,5,0.55)",
          textTransform: "uppercase",
        }}>
          XP
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Achievement glyph + count

const Achievement = ({ icon, value }) => {
  const t = useTheme();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, color: t.ink3, fontWeight: 600,
      fontFamily: "'Geist Mono', monospace",
    }}>
      <AchievementIcon name={icon} />
      {value}
    </span>
  );
};

const Milestone = ({ label, value, icon }) => {
  const t = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      padding: "5px 0",
      fontSize: 12,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 7,
        background: t.panel,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: t.ink2,
      }}>
        <AchievementIcon name={icon} size={11} />
      </span>
      <span style={{ color: t.ink3, flex: 1 }}>{label}</span>
      <span style={{ color: t.ink, fontWeight: 600, fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
};

const AchievementIcon = ({ name, size = 10 }) => {
  if (name === "commit") return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M6 1 v2.5 M6 8.5 v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
  if (name === "pr") return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <circle cx="3" cy="3" r="1.4" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="3" cy="9" r="1.4" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="9" cy="9" r="1.4" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3 4.4 v3.2 M4.4 9 h3.2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
  if (name === "ship") return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 7 L5 10 L10 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (name === "lines") return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 3 h8 M2 6 h8 M2 9 h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
  return null;
};

const TrophyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 1.5 h8 v4 a4 4 0 0 1 -8 0 z" stroke="#d6a83a" strokeWidth="1.4" fill="#f7d774"/>
    <path d="M3 2.5 H1 a1 1 0 0 0 -1 1 v1 a2 2 0 0 0 2 2 M11 2.5 H13 a1 1 0 0 1 1 1 v1 a2 2 0 0 1 -2 2" stroke="#d6a83a" strokeWidth="1.2" fill="none"/>
    <rect x="5" y="9" width="4" height="2" fill="#d6a83a"/>
    <rect x="3.5" y="11" width="7" height="2" rx="0.5" fill="#d6a83a"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// macOS window shell (kept)

const WindowShell = ({ width = 1100, height = 680, title, subtitle, toolbar, children }) => {
  const t = useTheme();
  return (
    <div style={{ width: width + 40, height: height + 40, padding: 18, boxSizing: "border-box", position: "relative" }}>
      <div style={{
        width: "100%", height: "100%",
        background: t.popover,
        borderRadius: 12,
        boxShadow: `0 30px 60px ${t.shadowStrong}, 0 0 0 1px ${t.border}`,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        color: t.ink, fontFamily: "'Geist', sans-serif", fontSize: 13,
      }}>
        <div style={{
          height: 42, display: "flex", alignItems: "center",
          padding: "0 16px",
          borderBottom: `1px solid ${t.divider}`,
          background: t.panel,
          gap: 12,
        }}>
          <div style={{ display: "flex", gap: 7 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57", border: "0.5px solid #e0443e" }} />
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e", border: "0.5px solid #dea123" }} />
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840", border: "0.5px solid #1aab29" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 14 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: "linear-gradient(135deg, #ff7e58, #d63916)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <RobinGlyph size={12} color="#fff7f3" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{title}</span>
            <span style={{ fontSize: 12, color: t.ink4 }}>·</span>
            <span style={{ fontSize: 12.5, color: t.ink2, whiteSpace: "nowrap" }}>{subtitle}</span>
          </div>
          <div style={{ flex: 1 }} />
          {toolbar}
        </div>
        {children}
      </div>
    </div>
  );
};

Object.assign(window, { ExpandedWindow, WindowShell, TeamRail, AgentChatPanel, LeaderboardRail });
