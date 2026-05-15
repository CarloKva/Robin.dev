// Popover view: DISCONNECTED — workspace not reachable
// Shows Clerk/Supabase auth state, last seen, retry CTA, last-cached snapshot.

const DisconnectedView = () => {
  return (
    <PopoverShell label="06 — Disconnected (auth/realtime failure)">
      <PopoverHeader workspace={MOCK_WORKSPACE} connected={false} agentsOnline={0} agentsTotal={6} />

      <div style={{
        padding: "20px 18px 16px",
        borderBottom: "1px solid #1f1f24",
        background: "linear-gradient(180deg, rgba(248,113,113,0.06) 0%, transparent 100%)",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: "rgba(248,113,113,0.1)",
          border: "1px solid rgba(248,113,113,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 10,
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 7 a4 4 0 0 1 4 -3 a4 4 0 0 1 4 3 M13 13 a4 4 0 0 1 -4 3 a4 4 0 0 1 -4 -3 M2 2 L18 18" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f4f4f5", marginBottom: 4 }}>
          Lost connection to workspace
        </div>
        <div style={{ fontSize: 11.5, color: "#a1a1aa", lineHeight: 1.45 }}>
          Supabase Realtime closed at <span style={{ fontFamily: "'Geist Mono', monospace", color: "#c4c4c8" }}>14:02:11</span>.
          Clerk session is still valid — likely a network drop. Showing the last cached snapshot.
        </div>
      </div>

      {/* diagnostic checklist */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #1f1f24" }}>
        <div style={{
          fontSize: 10, fontFamily: "'Geist Mono', monospace",
          color: "#71717a", textTransform: "uppercase", letterSpacing: 0.5,
          marginBottom: 8,
        }}>Health check</div>
        <DiagRow ok label="Clerk session" detail="marco@kakashi · valid 23h" />
        <DiagRow warn label="Supabase JWT" detail="refresh in 4m · template `supabase`" />
        <DiagRow err label="Realtime WS" detail="closed code=1006 · retrying in 3s…" />
        <DiagRow ok label="Last DB snapshot" detail="agents_with_status · 38s ago" />
      </div>

      {/* cached snapshot */}
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto" }}>
        <SectionHeader top right={<SnapshotBadge />}>
          Last known state · 38s ago
        </SectionHeader>
        {MOCK_AGENTS.slice(0, 4).map(a => (
          <div key={a.id} style={{
            padding: "8px 14px",
            borderBottom: "1px solid #1a1a1f",
            display: "flex", alignItems: "center", gap: 10,
            opacity: 0.55,
          }}>
            <StatusDot kind={a.status} size={7} />
            <span style={{ fontSize: 12, fontFamily: "'Geist Mono', monospace", color: "#c4c4c8" }}>{a.name}</span>
            <span style={{ fontSize: 10, color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>
              {STATUS_LABEL[a.status]}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: "#52525b", fontFamily: "'Geist Mono', monospace" }}>
              {a.repos[0]?.full_name.split("/")[1]}
            </span>
          </div>
        ))}
      </div>

      <PopoverFooter
        left={<Btn variant="primary" icon={
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M9 5.5 a3.5 3.5 0 1 1 -1 -2.5 M9 1 v2 h-2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        }>Reconnect</Btn>}
        right={<Btn variant="ghost">View logs ↗</Btn>}
      />
    </PopoverShell>
  );
};

const DiagRow = ({ ok, warn, err, label, detail }) => {
  const color = ok ? "#4ade80" : warn ? "#fbbf24" : "#f87171";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 0",
      fontSize: 11.5,
    }}>
      <span style={{
        width: 14, height: 14, borderRadius: "50%",
        background: `${color}18`, border: `1px solid ${color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {ok && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4 L3.3 5.8 L6.5 2.5" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {warn && <div style={{ width: 2, height: 6, background: color, borderRadius: 1 }} />}
        {err && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M2 2 L6 6 M6 2 L2 6" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>}
      </span>
      <span style={{ color: "#e4e4e7", fontWeight: 500 }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 10, color: "#71717a", fontFamily: "'Geist Mono', monospace" }}>{detail}</span>
    </div>
  );
};

window.DisconnectedView = DisconnectedView;
