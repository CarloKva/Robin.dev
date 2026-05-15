// Popover view: IN PROGRESS — what's actively being worked on, right now.

const InProgressView = () => {
  const t = useTheme();
  const inProgress = MOCK_TASKS.filter(x => x.status === "in_progress");

  return (
    <PopoverShell label="02 · In progress" sublabel="live work-in-flight">
      <PopoverHeader workspace={MOCK_WORKSPACE} connected />
      <div style={{ padding: "14px 16px 6px" }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: t.ink, letterSpacing: -0.2 }}>
          In progress
        </div>
        <div style={{ fontSize: 12.5, color: t.ink3, marginTop: 4, lineHeight: 1.45 }}>
          {inProgress.length} engineer{inProgress.length === 1 ? "" : "s"} actively shipping.
        </div>
      </div>
      <TabStrip
        active="wip"
        tabs={[
          { id: "inbox", label: "Inbox", count: MOCK_INBOX.filter(n => n.unread).length },
          { id: "wip", label: "In progress", count: inProgress.length, urgent: false },
          { id: "history", label: "History" },
        ]}
      />

      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {inProgress.map(task => <WipCard key={task.id} task={task} />)}
        </div>
      </div>

      <PopoverFooter
        left={<LiveLabel>streaming</LiveLabel>}
        right={<Btn variant="ghost" size="sm">Sprint board ↗</Btn>}
      />
    </PopoverShell>
  );
};

const WipCard = ({ task }) => {
  const t = useTheme();
  const agent = getAgent(task.agent_id);
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div style={{
      background: t.popover,
      border: `1px solid ${t.divider}`,
      borderRadius: 12,
      padding: "12px 12px 10px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 8 }}>
        <Avatar agent={agent} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>
              {agent.name.split(" ")[0]}
            </span>
            <span style={{ fontSize: 12, color: t.ink3, whiteSpace: "nowrap" }}>working on</span>
            <span style={{ flex: 1 }} />
            <PriorityDot priority={task.priority} />
          </div>
          <div style={{ fontSize: 13, color: t.ink, fontWeight: 500, lineHeight: 1.35 }}>
            {task.title}
          </div>
        </div>
      </div>

      {task.description && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 12, color: t.ink2, lineHeight: 1.5,
            overflow: "hidden",
            display: expanded ? "block" : "-webkit-box",
            WebkitLineClamp: expanded ? "none" : 2,
            WebkitBoxOrient: "vertical",
          }}>
            {task.description}
          </div>
          <button onClick={() => setExpanded(!expanded)} style={{
            marginTop: 4,
            background: "transparent", border: "none",
            color: t.accent, fontFamily: "inherit",
            fontSize: 11.5, fontWeight: 500,
            cursor: "pointer", padding: 0,
          }}>
            {expanded ? "Hide" : "View all"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <RepoChip name={task.repo} />
        <BranchTag name={task.branch} />
        {task.pr_number && (
          <span style={{
            fontSize: 11, color: t.info, fontWeight: 600,
            padding: "2px 8px", borderRadius: 999,
            background: t.infoSoft, whiteSpace: "nowrap",
          }}>PR #{task.pr_number}</span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: t.ink3, whiteSpace: "nowrap" }}>
          started {task.started}
        </span>
      </div>
    </div>
  );
};

Object.assign(window, { InProgressView });
