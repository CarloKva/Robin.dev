// Popover view: INBOX — email-style notifications from your team.
// Each card is a letter from an engineer summarizing what they shipped,
// what's awaiting review, or what failed. Read-only. Copy button per card.

const KIND_CONFIG = {
  shipped: { tone: "success", label: "shipped",          verb: "shipped", icon: "merge" },
  review:  { tone: "info",    label: "ready for review", verb: "wrote you", icon: "pr" },
  failed:  { tone: "danger",  label: "couldn't ship",    verb: "couldn't ship", icon: "x" },
};

const InboxView = () => {
  const t = useTheme();
  const unread = MOCK_INBOX.filter(n => n.unread).length;
  const inProg = MOCK_TASKS.filter(x => x.status === "in_progress").length;

  return (
    <PopoverShell label="01 · Inbox" sublabel="email-style team digest, read-only">
      <PopoverHeader workspace={MOCK_WORKSPACE} connected />

      <div style={{ padding: "14px 16px 6px" }}>
        <div style={{
          fontSize: 12, color: t.ink3, fontWeight: 500,
          marginBottom: 4,
        }}>
          Back to work, {MOCK_WORKSPACE.member}.
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: t.ink, letterSpacing: -0.2 }}>
          Inbox
        </div>
        <div style={{ fontSize: 12.5, color: t.ink3, marginTop: 4, lineHeight: 1.45 }}>
          {unread > 0
            ? <><b style={{ color: t.ink2, fontWeight: 600 }}>{unread} new</b> from your team this morning.</>
            : <>You're caught up.</>}
        </div>
      </div>

      <TabStrip
        active="inbox"
        tabs={[
          { id: "inbox", label: "Inbox", count: unread, urgent: false },
          { id: "wip", label: "In progress", count: inProg },
          { id: "history", label: "History" },
        ]}
      />

      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MOCK_INBOX.map(n => <InboxCard key={n.id} n={n} />)}
        </div>
        <div style={{ padding: "16px 4px", textAlign: "center", color: t.ink4, fontSize: 11.5 }}>
          That's everything from the last 7 days
        </div>
      </div>

      <PopoverFooter
        left={<Btn variant="ghost" size="sm">Mark all read</Btn>}
        right={
          <Btn variant="ghost" size="sm" icon={
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5 7 L8 4 M5 4 h3 v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="1" y="2.5" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
          }>Open web</Btn>
        }
      />
    </PopoverShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// InboxCard — one notification

const InboxCard = ({ n }) => {
  const t = useTheme();
  const agent = getAgent(n.agent_id);
  const cfg = KIND_CONFIG[n.kind];
  const tone = cfg.tone;
  const accentColor = t[tone];
  const accentSoft = t[tone + "Soft"];

  return (
    <div style={{
      background: n.unread ? t.popover : t.popover,
      border: `1px solid ${n.unread ? t.border : t.divider}`,
      borderRadius: 12,
      padding: "12px 12px 11px",
      position: "relative",
      opacity: n.unread ? 1 : 0.92,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <Avatar agent={agent} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>
              {agent.name.split(" ")[0]}
            </span>
            <KindTag kind={n.kind} />
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: t.ink3, whiteSpace: "nowrap" }}>{n.at}</span>
          </div>
          <div style={{
            fontSize: 12.5, color: t.ink, fontWeight: 600, lineHeight: 1.35,
            marginBottom: 6,
          }}>
            {n.task_title}
          </div>
        </div>
      </div>

      {/* body — quoted summary */}
      <div style={{
        fontSize: 12.5, color: t.ink2, lineHeight: 1.55,
        marginTop: 6,
      }}>
        {n.body}
      </div>

      {/* error block (failed only) */}
      {n.error && (
        <div style={{
          marginTop: 8,
          padding: "8px 10px",
          background: t.dangerSoft,
          borderRadius: 7,
          fontSize: 11.5, fontFamily: "'Geist Mono', monospace",
          color: t.danger, lineHeight: 1.5,
        }}>{n.error}</div>
      )}

      {/* footer — tags + PR + copy */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginTop: 10, paddingTop: 10,
        borderTop: `1px solid ${t.divider}`,
        flexWrap: "wrap",
      }}>
        <RepoChip name={n.repo} />
        {n.duration && (
          <span style={{ fontSize: 11, color: t.ink3, whiteSpace: "nowrap" }}>
            took {n.duration}
          </span>
        )}
        {n.tokens && (
          <span style={{
            fontSize: 11, color: t.ink3,
            display: "inline-flex", alignItems: "center", gap: 4,
            whiteSpace: "nowrap",
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1 a3 3 0 0 0 -3 3 v2 a3 3 0 0 0 6 0 v-2 a3 3 0 0 0 -3 -3 z M5 4 v2 M3.5 5 h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            {n.tokens}
            <span style={{ color: t.ink4 }}>tok</span>
          </span>
        )}
        <span style={{ flex: 1 }} />
        {n.pr && (
          <PRChip pr={n.pr} merged={n.pr.merged} />
        )}
        <CopyBtn note={n} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const KindTag = ({ kind }) => {
  const t = useTheme();
  const cfg = KIND_CONFIG[kind];
  const c = t[cfg.tone];
  const soft = t[cfg.tone + "Soft"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 500, color: c,
      padding: "1px 8px", borderRadius: 999,
      background: soft, whiteSpace: "nowrap",
    }}>
      {kind === "shipped" && <ShippedIcon color={c} />}
      {kind === "review"  && <ReviewIcon color={c} />}
      {kind === "failed"  && <FailedIcon color={c} />}
      {cfg.label}
    </span>
  );
};

const ShippedIcon = ({ color }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <circle cx="2.5" cy="2.5" r="1.2" stroke={color} strokeWidth="1.1"/>
    <circle cx="2.5" cy="7.5" r="1.2" stroke={color} strokeWidth="1.1"/>
    <circle cx="7.5" cy="7" r="1.2" stroke={color} strokeWidth="1.1"/>
    <path d="M2.5 3.7 v2.6 M2.5 7.5 c3 0 5 -1.5 5 -3" stroke={color} strokeWidth="1.1" fill="none"/>
  </svg>
);
const ReviewIcon = ({ color }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <circle cx="2.5" cy="2.5" r="1.2" stroke={color} strokeWidth="1.1"/>
    <circle cx="2.5" cy="7.5" r="1.2" stroke={color} strokeWidth="1.1"/>
    <circle cx="7.5" cy="7.5" r="1.2" stroke={color} strokeWidth="1.1"/>
    <path d="M2.5 3.7 v2.6 M3.7 7.5 h2.6" stroke={color} strokeWidth="1.1"/>
  </svg>
);
const FailedIcon = ({ color }) => (
  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M3 3 L7 7 M7 3 L3 7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>
);

const PRChip = ({ pr, merged }) => {
  const t = useTheme();
  return (
    <a href="#" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999,
      background: merged ? t.successSoft : t.infoSoft,
      color: merged ? t.success : t.info,
      fontSize: 11, fontWeight: 600,
      textDecoration: "none", whiteSpace: "nowrap",
    }}>
      {merged ? <ShippedIcon color={t.success} /> : <ReviewIcon color={t.info} />}
      PR #{pr.number}
      <span style={{ color: t.ink3, fontWeight: 500, fontFamily: "'Geist Mono', monospace", fontSize: 10 }}>
        ↗
      </span>
    </a>
  );
};

const CopyBtn = ({ note }) => {
  const t = useTheme();
  const [copied, setCopied] = React.useState(false);
  const onClick = () => {
    const text = `${note.task_title}\n\n${note.body}${note.pr ? `\n\nPR: https://${note.pr.url}` : ""}${note.error ? `\n\nError: ${note.error}` : ""}${note.duration || note.tokens ? `\n\n${note.duration ? `Time: ${note.duration}` : ""}${note.duration && note.tokens ? " · " : ""}${note.tokens ? `Tokens: ${note.tokens}` : ""}` : ""}`;
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button onClick={onClick} title="Copy for brainstorming" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px",
      background: "transparent",
      color: copied ? t.success : t.ink3,
      border: `1px solid ${copied ? t.successBorder : t.border}`,
      borderRadius: 7,
      fontSize: 11, fontWeight: 500, fontFamily: "inherit",
      cursor: "pointer",
      whiteSpace: "nowrap",
    }}>
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4 7 L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="3" y="3" width="6" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M2 7.5 V2 a1 1 0 0 1 1 -1 H7.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          </svg>
          Copy
        </>
      )}
    </button>
  );
};

Object.assign(window, { InboxView, InboxCard, CopyBtn, PRChip, KindTag });
