// Popover view: NEW TASK quick capture
// POST /api/tasks — title, repo selector, priority, optional sprint attach.

const NewTaskView = () => {
  const [title, setTitle] = React.useState("Add retry budget for outbound webhooks (5min cap)");
  const [repo, setRepo] = React.useState("kakashi/billing-core");
  const [priority, setPriority] = React.useState("med");
  const [attachSprint, setAttachSprint] = React.useState(true);
  const [agent, setAgent] = React.useState("auto");

  return (
    <PopoverShell label="05 — New task · quick capture">
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px",
        borderBottom: "1px solid #1f1f24",
        background: "linear-gradient(180deg, #161619 0%, #131316 100%)",
      }}>
        <IconBtn>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M7 2 L3 6 L7 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconBtn>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#f4f4f5" }}>New task</div>
          <div style={{ fontSize: 10.5, color: "#71717a", marginTop: 1, fontFamily: "'Geist Mono', monospace" }}>
            POST /api/tasks
          </div>
        </div>
        <Kbd>Esc</Kbd>
      </div>

      {/* Title — large auto-focus textarea */}
      <div style={{ padding: "14px 14px 10px" }}>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={3}
          autoFocus
          style={{
            width: "100%", resize: "none",
            background: "transparent", border: "none", outline: "none",
            color: "#f4f4f5", fontFamily: "inherit",
            fontSize: 15, fontWeight: 500,
            lineHeight: 1.35,
          }}
          placeholder="What should the agent build?"
        />
        <div style={{
          fontSize: 11, color: "#71717a", marginTop: 6,
          lineHeight: 1.4,
        }}>
          <span style={{ color: "#a1a1aa" }}>Tip:</span> describe outcome, acceptance criteria,
          and files to touch. Agent reads this verbatim.
        </div>
      </div>

      {/* fields */}
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
        <Field label="Repo" mono>
          <PickerRow
            value={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1 a4.5 4.5 0 0 0 0 9 a4.5 4.5 0 0 0 0 -9 z" stroke="#a1a1aa" strokeWidth="0.5" fill="#a1a1aa"/></svg>
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{repo}</span>
                <span style={{ fontSize: 9.5, color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>· main</span>
              </span>
            }
          />
        </Field>

        <Field label="Priority">
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "high", label: "P0 · High", color: "#f87171" },
              { id: "med", label: "P1 · Med", color: "#fbbf24" },
              { id: "low", label: "P2 · Low", color: "#71717a" },
            ].map(p => (
              <button key={p.id} onClick={() => setPriority(p.id)} style={{
                flex: 1, padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                background: priority === p.id ? `${p.color}15` : "rgba(255,255,255,0.03)",
                border: `1px solid ${priority === p.id ? `${p.color}55` : "rgba(255,255,255,0.06)"}`,
                color: priority === p.id ? p.color : "#a1a1aa",
                fontSize: 11, fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: p.color, opacity: priority === p.id ? 1 : 0.5,
                }} />
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Agent">
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <AgentChip
              name="auto-pick"
              active={agent === "auto"}
              onClick={() => setAgent("auto")}
              hint="round-robin idle workers"
            />
            {MOCK_AGENTS.filter(a => a.status === "idle" || a.status === "busy").slice(0, 3).map(a => (
              <AgentChip key={a.id}
                name={a.name}
                status={a.status}
                active={agent === a.id}
                onClick={() => setAgent(a.id)}
              />
            ))}
          </div>
        </Field>

        <Field label="Sprint">
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px",
            background: attachSprint ? "rgba(255,106,61,0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${attachSprint ? "rgba(255,106,61,0.22)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 6, cursor: "pointer",
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 4,
              background: attachSprint ? "#ff6a3d" : "transparent",
              border: `1.5px solid ${attachSprint ? "#ff6a3d" : "#52525b"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }} onClick={() => setAttachSprint(!attachSprint)}>
              {attachSprint && (
                <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2 4.5 L4 6.5 L7 2.5" stroke="#1a0a05" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#f4f4f5" }}>Add to current sprint</div>
              <div style={{ fontSize: 10, color: "#71717a", marginTop: 1, fontFamily: "'Geist Mono', monospace" }}>
                SP_MAY15 · ends in 3d 4h
              </div>
            </div>
            <span style={{
              fontSize: 9.5, color: "#71717a", fontFamily: "'Geist Mono', monospace",
              textTransform: "uppercase", letterSpacing: 0.4,
            }}>
              {attachSprint ? "executes now" : "goes to backlog"}
            </span>
          </label>
        </Field>

        <Field label="Attach">
          <button style={{
            width: "100%", padding: "8px 10px",
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed rgba(255,255,255,0.1)",
            borderRadius: 6, color: "#71717a",
            fontSize: 11.5, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            cursor: "pointer",
          }}>
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1 v9 M1 5.5 h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            Screenshots, logs, design files
          </button>
        </Field>
      </div>

      <PopoverFooter
        left={<span style={{ fontSize: 10.5, color: "#71717a", fontFamily: "'Geist Mono', monospace", paddingLeft: 4 }}>
          Need a longer brief? <span style={{ color: "#ff8a5a" }}>Open web ↗</span>
        </span>}
        right={
          <>
            <Btn variant="ghost"><Kbd>Esc</Kbd></Btn>
            <Btn variant="primary" icon={
              <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 5.5 L9 5.5 M6 2 L9.5 5.5 L6 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }>Send · ⌘↵</Btn>
          </>
        }
      />
    </PopoverShell>
  );
};

const Field = ({ label, children, mono }) => (
  <div style={{ padding: "8px 10px" }}>
    <div style={{
      fontSize: 9.5, fontFamily: "'Geist Mono', monospace",
      color: "#52525b", textTransform: "uppercase", letterSpacing: 0.5,
      marginBottom: 5, padding: "0 4px",
    }}>{label}</div>
    {children}
  </div>
);

const PickerRow = ({ value }) => (
  <button style={{
    width: "100%",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 6, padding: "7px 10px",
    color: "#e4e4e7", fontSize: 12, fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    cursor: "pointer",
  }}>
    {value}
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: "#71717a" }}>
      <path d="M3 4 L5 6 L7 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </button>
);

const AgentChip = ({ name, status, active, onClick, hint }) => (
  <button onClick={onClick} style={{
    padding: "5px 9px", borderRadius: 5,
    background: active ? "rgba(255,106,61,0.12)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(255,106,61,0.3)" : "rgba(255,255,255,0.06)"}`,
    color: active ? "#ff8a5a" : "#c4c4c8",
    fontSize: 11, fontFamily: "'Geist Mono', monospace",
    cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 5,
  }}>
    {status && <StatusDot kind={status} size={5} />}
    {name}
    {hint && <span style={{ color: "#52525b", fontSize: 9.5 }}>· {hint}</span>}
  </button>
);

window.NewTaskView = NewTaskView;
