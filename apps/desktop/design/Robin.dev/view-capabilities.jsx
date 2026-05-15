// Capabilities — library of skill packs engineers can install on their
// Claude Code instance. VS Code extensions vibe, but curated for AI engineers.

const CATEGORIES = ["All", "Frontend", "Backend", "Mobile", "Infra", "Testing", "Ops", "Design"];

const CapabilityIcon = ({ name, color, size = 22 }) => {
  const map = {
    card: <><rect x="2" y="4" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M2 6 h10 M4 8 h2" stroke="currentColor" strokeWidth="1.3"/></>,
    database: <><ellipse cx="7" cy="3" rx="4" ry="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M3 3 v5 c0 0.8 1.8 1.5 4 1.5 s4 -0.7 4 -1.5 v-5 M3 6 c0 0.8 1.8 1.5 4 1.5 s4 -0.7 4 -1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/></>,
    bell: <><path d="M3 9 a1 1 0 0 0 1 1 h6 a1 1 0 0 0 1 -1 c-1 -1 -1.5 -2 -1.5 -4 a3 3 0 0 0 -6 0 c0 2 -0.5 3 -1.5 4 z M6 11 h2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></>,
    react: <><circle cx="7" cy="7" r="1.3" fill="currentColor"/><ellipse cx="7" cy="7" rx="5" ry="2" stroke="currentColor" strokeWidth="1.1" fill="none"/><ellipse cx="7" cy="7" rx="5" ry="2" stroke="currentColor" strokeWidth="1.1" fill="none" transform="rotate(60 7 7)"/><ellipse cx="7" cy="7" rx="5" ry="2" stroke="currentColor" strokeWidth="1.1" fill="none" transform="rotate(120 7 7)"/></>,
    palette: <><path d="M7 1.5 a5.5 5.5 0 0 0 0 11 c1 0 1.5 -0.5 1.5 -1.2 c0 -0.6 -0.4 -0.7 -0.4 -1.3 c0 -0.6 0.5 -1 1 -1 h1.5 a2 2 0 0 0 2 -2 a5.5 5.5 0 0 0 -5.6 -5.5 z" stroke="currentColor" strokeWidth="1.3" fill="none"/><circle cx="4" cy="5.5" r="0.7" fill="currentColor"/><circle cx="6" cy="3.5" r="0.7" fill="currentColor"/><circle cx="9.5" cy="4.5" r="0.7" fill="currentColor"/></>,
    test: <><path d="M5 1.5 v3 L2.5 8 a1 1 0 0 0 1 1.5 h7 a1 1 0 0 0 1 -1.5 L9 4.5 v-3 z M4 1.5 h6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/><circle cx="5" cy="7" r="0.7" fill="currentColor"/><circle cx="7.5" cy="8" r="0.5" fill="currentColor"/></>,
    shield: <><path d="M7 1.5 L11.5 3.5 v3.5 c0 2.5 -2 5 -4.5 6 c-2.5 -1 -4.5 -3.5 -4.5 -6 v-3.5 z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/><path d="M5 7 L6.5 8.5 L9 5.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
    cloud: <><path d="M4 9.5 a2.5 2.5 0 0 1 0 -5 a3.5 3.5 0 0 1 6.5 0.5 a2.5 2.5 0 0 1 -1 4.5 z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></>,
    container: <><rect x="2" y="3" width="10" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M2 6 h10 M5 3 v8 M9 3 v8" stroke="currentColor" strokeWidth="1.3"/></>,
    spec: <><rect x="2.5" y="1.5" width="9" height="11" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 4.5 h4 M5 6.5 h4 M5 8.5 h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    alert: <><path d="M7 1.5 L13 12 H1 z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/><path d="M7 5 v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="7" cy="10" r="0.6" fill="currentColor"/></>,
    figma: <><circle cx="5.2" cy="3.3" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8.8" cy="3.3" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="5.2" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="5.2" cy="10.5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8.8" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" style={{ color }}>
      {map[name] || map["spec"]}
    </svg>
  );
};

const CapabilitiesView = () => {
  const t = useTheme();
  const [filter, setFilter] = React.useState("All");
  const [search, setSearch] = React.useState("");

  let list = MOCK_CAPABILITIES;
  if (filter !== "All") list = list.filter(c => c.category === filter);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.summary.toLowerCase().includes(q) ||
      c.tags.some(tag => tag.includes(q))
    );
  }
  const featured = MOCK_CAPABILITIES.filter(c => c.popular).slice(0, 3);

  return (
    <WindowShell title="Robin.dev · Capabilities" subtitle="library of skills for your engineers" width={1100} height={680}
      toolbar={<>
        <Btn variant="ghost" size="md">Open submissions</Btn>
        <Btn variant="primary" size="md" icon={
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1.5 v8 M1.5 5.5 h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
        }>Build new</Btn>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, background: t.popover }}>
        {/* Page header */}
        <div style={{
          padding: "24px 28px 16px",
          borderBottom: `1px solid ${t.divider}`,
        }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: t.ink, letterSpacing: -0.3 }}>Capabilities</div>
              <div style={{ fontSize: 13, color: t.ink3, marginTop: 4, lineHeight: 1.5, maxWidth: 580 }}>
                Skill packs you can install into an engineer's Claude Code instance.
                Think VS Code extensions — but curated for AI engineers.
              </div>
            </div>
            <SearchBox value={search} onChange={setSearch} />
          </div>

          {/* Category filters */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CATEGORIES.map(cat => {
              const active = cat === filter;
              return (
                <button key={cat} onClick={() => setFilter(cat)} style={{
                  padding: "5px 12px", borderRadius: 999,
                  background: active ? t.ink : "transparent",
                  color: active ? t.popover : t.ink2,
                  border: active ? "none" : `1px solid ${t.border}`,
                  fontSize: 12, fontWeight: 500, fontFamily: "inherit",
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "all 0.12s",
                }}>{cat}</button>
              );
            })}
          </div>
        </div>

        <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 28px 32px" }}>
          {/* Featured row */}
          {filter === "All" && !search && (
            <>
              <SectionHeader top>Featured</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 8 }}>
                {featured.map(c => <FeaturedCard key={c.id} cap={c} />)}
              </div>
            </>
          )}

          <SectionHeader>
            {filter === "All" ? "All capabilities" : filter} · {list.length}
          </SectionHeader>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12,
            paddingTop: 4,
          }}>
            {list.map(c => <CapabilityCard key={c.id} cap={c} />)}
          </div>

          {list.length === 0 && (
            <div style={{
              padding: "40px 16px", textAlign: "center",
              fontSize: 13, color: t.ink3,
            }}>
              No capabilities match your search.
            </div>
          )}
        </div>
      </div>
    </WindowShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Featured card — bigger, hero-y treatment

const FeaturedCard = ({ cap }) => {
  const t = useTheme();
  const tone = cap.tone || "info";
  const accent = t[tone];
  const soft = t[tone + "Soft"];
  return (
    <div style={{
      background: `linear-gradient(180deg, ${soft}, ${t.popover})`,
      border: `1px solid ${t[tone + "Border"]}`,
      borderRadius: 14, padding: "16px 16px 14px",
      cursor: "pointer",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 12 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 10,
          background: "#ffffff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `inset 0 0 0 1px ${t[tone + "Border"]}`,
        }}>
          <CapabilityIcon name={cap.icon} color={accent} size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>{cap.name}</span>
            {cap.official && <OfficialBadge />}
          </div>
          <div style={{ fontSize: 11, color: t.ink3 }}>
            {cap.category} · {cap.version}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: t.ink2, lineHeight: 1.5, minHeight: 38 }}>
        {cap.summary}
      </div>
      <div style={{
        marginTop: 12, paddingTop: 12,
        borderTop: `1px solid ${t.divider}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Stars value={cap.rating} />
        <span style={{ fontSize: 11, color: t.ink3 }}>{(cap.installs / 1000).toFixed(1)}k installs</span>
        <span style={{ flex: 1 }} />
        <Btn variant="primary" size="sm">Install</Btn>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Regular card

const CapabilityCard = ({ cap }) => {
  const t = useTheme();
  const tone = cap.tone || "info";
  const accent = t[tone];
  const soft = t[tone + "Soft"];
  const installedBy = cap.installed_by.map(id => getAgent(id)).filter(Boolean);
  const isInstalled = installedBy.length > 0;

  return (
    <div style={{
      background: t.popover,
      border: `1px solid ${t.divider}`,
      borderRadius: 12,
      padding: "14px",
      cursor: "pointer",
      transition: "border-color 0.15s, box-shadow 0.15s",
    }}
    onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(85,65,30,0.06)"}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 10 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 9,
          background: soft, color: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <CapabilityIcon name={cap.icon} color={accent} size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>
              {cap.name}
            </span>
            {cap.official && <OfficialBadge mini />}
          </div>
          <div style={{ fontSize: 10.5, color: t.ink3, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <span>{cap.category}</span>
            <span style={{ color: t.ink4 }}>·</span>
            <span style={{ fontFamily: "'Geist Mono', monospace" }}>{cap.version}</span>
            <span style={{ color: t.ink4 }}>·</span>
            <Stars value={cap.rating} mini />
          </div>
        </div>
      </div>

      <div style={{
        fontSize: 12, color: t.ink2, lineHeight: 1.5,
        marginBottom: 10,
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        minHeight: 36,
      }}>
        {cap.summary}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingTop: 10,
        borderTop: `1px solid ${t.divider}`,
      }}>
        {installedBy.length > 0 ? (
          <>
            <span style={{ display: "inline-flex" }}>
              {installedBy.slice(0, 3).map((a, i) => (
                <span key={a.id} style={{ marginLeft: i === 0 ? 0 : -7, position: "relative" }}>
                  <span style={{ display: "inline-block", borderRadius: "50%", boxShadow: `0 0 0 1.5px ${t.popover}` }}>
                    <Avatar agent={a} size="xs" showStatus={false} />
                  </span>
                </span>
              ))}
              {installedBy.length > 3 && (
                <span style={{ marginLeft: -7, width: 22, height: 22, borderRadius: "50%", background: t.panel, fontSize: 9, fontWeight: 600, color: t.ink2, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${t.popover}` }}>+{installedBy.length - 3}</span>
              )}
            </span>
            <span style={{ fontSize: 11, color: t.ink3, whiteSpace: "nowrap" }}>
              installed by {installedBy.map(a => a.name.split(" ")[0]).slice(0, 2).join(", ")}{installedBy.length > 2 ? `, +${installedBy.length - 2}` : ""}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: t.ink4 }}>
            Not installed yet · {(cap.installs).toLocaleString()} installs
          </span>
        )}
        <span style={{ flex: 1 }} />
        {isInstalled ? (
          <Btn variant="successSoft" size="sm" icon={
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4 7 L8 3" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }>Installed</Btn>
        ) : (
          <Btn variant="secondary" size="sm" icon={
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1 v6 M2 5 L5 8 L8 5 M1 9 h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }>Install</Btn>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Bits

const Stars = ({ value, mini }) => {
  const t = useTheme();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: mini ? 10.5 : 11, color: t.ink2, fontWeight: 600,
    }}>
      <svg width={mini ? 10 : 12} height={mini ? 10 : 12} viewBox="0 0 12 12" fill="#f5b942">
        <path d="M6 1 L7.6 4.3 L11 4.8 L8.5 7.2 L9.1 10.5 L6 8.9 L2.9 10.5 L3.5 7.2 L1 4.8 L4.4 4.3 z" />
      </svg>
      {value.toFixed(1)}
    </span>
  );
};

const OfficialBadge = ({ mini }) => {
  const t = useTheme();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: mini ? 9.5 : 10, fontWeight: 600,
      color: t.accent,
      padding: mini ? "1px 6px" : "2px 7px", borderRadius: 999,
      background: t.accentSoft, whiteSpace: "nowrap",
    }}>
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M4.5 0.8 L5.6 2.5 L7.5 2.8 L6.1 4.2 L6.5 6.2 L4.5 5.3 L2.5 6.2 L2.9 4.2 L1.5 2.8 L3.4 2.5 z" fill="currentColor"/>
      </svg>
      Official
    </span>
  );
};

const SearchBox = ({ value, onChange }) => {
  const t = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 12px",
      background: t.panel,
      borderRadius: 9,
      border: `1px solid ${t.divider}`,
      width: 240,
      fontFamily: "inherit",
    }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: t.ink3, flexShrink: 0 }}>
        <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8.7 8.7 L11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search capabilities…"
        style={{
          flex: 1, minWidth: 0,
          background: "transparent", border: "none", outline: "none",
          fontFamily: "inherit", fontSize: 12, color: t.ink,
        }}
      />
    </div>
  );
};

Object.assign(window, { CapabilitiesView });
