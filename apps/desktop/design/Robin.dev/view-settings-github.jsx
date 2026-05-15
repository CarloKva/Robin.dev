// Settings · GitHub — connection status + repository list + environments.

const GH_REPOS = [
  { name: "newjee", private: true, branch: "main", desc: null, enabled: true },
  { name: "unicredit-life-next", private: true, branch: "master", desc: null, enabled: true },
  { name: "madara-hono-backend", private: true, branch: "main", desc: null },
  { name: "kva-website", private: true, branch: "main", desc: null },
  { name: "lamms", private: true, branch: "main", desc: null },
  { name: "longevity-navigator", private: true, branch: "main",
    desc: "Longevity Navigator — B2B web platform for financial planning based on longevity." },
  { name: "supastarter-setup", private: true, branch: "main",
    desc: "Next.js starter with optional Hono backend. Postmark · GA · Prisma · Postgres." },
  { name: "intesa-universo-migration", private: true, branch: "main",
    desc: "AI-assisted pipeline migrating ~80 legacy .NET Framework apps to .NET 9 / C# 13." },
  { name: "TsunAI", private: true, branch: "main",
    desc: "People Management Platform." },
  { name: "deidara-ai", private: true, branch: "main",
    desc: "AI-powered art exhibition platform." },
  { name: "JirayIA", private: true, branch: "main",
    desc: "AI learning platform — corsi, attività, percorsi didattici." },
  { name: "hiraishin-backend", private: true, branch: "main", desc: "Hiraishin backend server." },
  { name: "magellan-web", private: true, branch: "main",
    desc: "MAGELLAN — Multi-Agent Generative Exploration of Latent Links Across kNowledge." },
  { name: "angelicadb", private: true, branch: "main",
    desc: "EpistemicDB — knowledge with decay, confidence, and gaps." },
  { name: "agentstreet", private: true, branch: "main",
    desc: "Marketplace for specialized agents." },
];

const SettingsGitHubView = () => {
  const t = useTheme();
  const [search, setSearch] = React.useState("");
  const [repos, setRepos] = React.useState(GH_REPOS);
  const filtered = search
    ? repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : repos;
  const enabledCount = repos.filter(r => r.enabled).length;
  const toggle = (name) => setRepos(rs => rs.map(r => r.name === name ? { ...r, enabled: !r.enabled } : r));

  return (
    <SettingsShell
      active="github"
      title="GitHub"
      subtitle="Connect your account and choose the repositories your engineers can work on."
      label="10 · Settings · GitHub"
    >
      <div style={{ padding: "22px 28px 32px" }}>
        {/* Connection card */}
        <div style={{
          background: t.popover,
          border: `1px solid ${t.divider}`,
          borderRadius: 12,
          padding: "16px 18px",
          display: "flex", alignItems: "flex-start", gap: 14,
          marginBottom: 24,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "#181614",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 1 a10 10 0 0 0 -3.2 19.5 c0.5 0 0.7 -0.3 0.7 -0.7 v-2.5 c-2.8 0.6 -3.4 -1.3 -3.4 -1.3 c-0.4 -1.2 -1.1 -1.5 -1.1 -1.5 c-0.9 -0.6 0.1 -0.6 0.1 -0.6 c1 0.1 1.5 1 1.5 1 c0.9 1.5 2.4 1.1 3 0.8 c0.1 -0.7 0.4 -1.1 0.7 -1.4 c-2.2 -0.2 -4.5 -1.1 -4.5 -4.9 c0 -1.1 0.4 -2 1 -2.7 c-0.1 -0.2 -0.4 -1.2 0.1 -2.5 c0 0 0.8 -0.3 2.6 1 a9 9 0 0 1 4.8 0 c1.8 -1.3 2.6 -1 2.6 -1 c0.5 1.3 0.2 2.3 0.1 2.5 c0.6 0.7 1 1.6 1 2.7 c0 3.8 -2.3 4.7 -4.5 4.9 c0.4 0.3 0.7 0.9 0.7 1.8 v2.7 c0 0.4 0.2 0.7 0.7 0.7 a10 10 0 0 0 -3.2 -19.5" fill="#ffffff" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>Connected</span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, color: t.success, fontWeight: 600,
                padding: "2px 8px", borderRadius: 999,
                background: t.successSoft,
              }}>
                <LiveDot size={5} /> active
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: t.ink2, marginBottom: 8 }}>
              Linked to <b>@kakashi-ventures</b> · Organization install
            </div>
            <div style={{ fontSize: 11.5, color: t.ink3, lineHeight: 1.5 }}>
              Robin.dev App is installed on @kakashi-ventures. The accessible repositories
              depend on the app configuration on GitHub.
              <a href="#" style={{ color: t.accent, textDecoration: "none", marginLeft: 4, fontWeight: 500 }}>
                Manage on GitHub ↗
              </a>
            </div>
          </div>
          <Btn variant="ghost" size="md">Disconnect</Btn>
        </div>

        {/* Repositories */}
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>Repositories</div>
            <div style={{ fontSize: 12, color: t.ink3, marginTop: 3 }}>
              Enable the repositories your engineers can operate on.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11.5, color: t.ink3, whiteSpace: "nowrap" }}>
              <b style={{ color: t.ink, fontWeight: 600 }}>{enabledCount}</b> of <b>{repos.length}</b> enabled
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search repositories…" />
        </div>

        <div style={{
          background: t.popover,
          border: `1px solid ${t.divider}`,
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {filtered.map((r, i) => (
            <RepoRow key={r.name} repo={r} isLast={i === filtered.length - 1} onToggle={() => toggle(r.name)} />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: t.ink3, fontSize: 12.5 }}>
              No repositories match your search.
            </div>
          )}
        </div>

        {/* Environments */}
        <div style={{ marginTop: 28, marginBottom: 12, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>Environments</div>
            <div style={{ fontSize: 12, color: t.ink3, marginTop: 3 }}>
              Map staging and production environments to specific branches. Optional auto-merge.
            </div>
          </div>
          <Btn variant="secondary" size="md" icon={
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1.5 v8 M1.5 5.5 h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          }>New environment</Btn>
        </div>

        <EnvironmentCard
          repo="kakashi-ventures/newjee"
          envs={[
            { name: "staging", branch: "staging", autoMerge: true },
            { name: "production", branch: "main", autoMerge: false },
          ]}
        />

        <div style={{
          marginTop: 12, padding: "12px 14px",
          background: t.panel, borderRadius: 10,
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, color: t.ink3,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 4 v3.5 M7 9.5 v0.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>Repositories without environments will deploy via PR merges only:</span>
          <span style={{
            fontSize: 11.5, fontFamily: "'Geist Mono', monospace", color: t.ink2,
            padding: "2px 8px", borderRadius: 6, background: t.popover,
          }}>kakashi-ventures/TsunAI</span>
          <span style={{
            fontSize: 11.5, fontFamily: "'Geist Mono', monospace", color: t.ink2,
            padding: "2px 8px", borderRadius: 6, background: t.popover,
          }}>kakashi-ventures/vesta</span>
        </div>
      </div>
    </SettingsShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Repo row

const RepoRow = ({ repo, isLast, onToggle }) => {
  const t = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px",
      borderBottom: isLast ? "none" : `1px solid ${t.divider}`,
      background: repo.enabled ? t.accentSoft : "transparent",
      transition: "background 0.12s",
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 7,
        background: t.panel,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        color: t.ink3,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 1.5 h6 a1.5 1.5 0 0 1 1.5 1.5 v8 a1.5 1.5 0 0 1 -1.5 1.5 H4 a1.5 1.5 0 0 1 -1.5 -1.5 V3 a1.5 1.5 0 0 1 1.5 -1.5 z M3 9.5 h7" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: t.ink,
            fontFamily: "'Geist Mono', monospace",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <span style={{ color: t.ink3, fontWeight: 500 }}>kakashi-ventures / </span>{repo.name}
          </span>
          {repo.private && (
            <span style={{
              fontSize: 10, color: t.ink3, fontWeight: 500,
              padding: "1px 7px", borderRadius: 999,
              background: t.panel,
              whiteSpace: "nowrap",
            }}>private</span>
          )}
        </div>
        {repo.desc && (
          <div style={{
            fontSize: 11.5, color: t.ink3, lineHeight: 1.45,
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
            marginBottom: 3,
          }}>{repo.desc}</div>
        )}
        <div style={{ fontSize: 10.5, color: t.ink4, fontFamily: "'Geist Mono', monospace", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="3" cy="2.5" r="0.9" stroke="currentColor" strokeWidth="0.9"/>
            <circle cx="3" cy="7.5" r="0.9" stroke="currentColor" strokeWidth="0.9"/>
            <circle cx="7" cy="5" r="0.9" stroke="currentColor" strokeWidth="0.9"/>
            <path d="M3 3.5 v3 M3.9 7.5 c1.5 0 2.2 -1 2.2 -2.5" stroke="currentColor" strokeWidth="0.9" fill="none"/>
          </svg>
          branch: {repo.branch}
        </div>
      </div>
      <Toggle on={!!repo.enabled} onChange={onToggle} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Environment card

const EnvironmentCard = ({ repo, envs }) => {
  const t = useTheme();
  return (
    <div style={{
      background: t.popover,
      border: `1px solid ${t.divider}`,
      borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: t.ink3, flexShrink: 0 }}>
          <path d="M3 1.5 h6 a1.5 1.5 0 0 1 1.5 1.5 v8 a1.5 1.5 0 0 1 -1.5 1.5 H4 a1.5 1.5 0 0 1 -1.5 -1.5 V3 a1.5 1.5 0 0 1 1.5 -1.5 z" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Geist Mono', monospace", color: t.ink, whiteSpace: "nowrap" }}>
          {repo}
        </span>
        <span style={{ flex: 1 }} />
        <Btn variant="ghost" size="sm" icon={
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1.5 v8 M1.5 5.5 h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        }>Add env</Btn>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10,
      }}>
        {envs.map(env => (
          <div key={env.name} style={{
            border: `1px solid ${t.divider}`,
            borderRadius: 10,
            padding: "12px 14px",
            background: t.panel,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: env.name === "production" ? t.danger : t.success,
              }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, textTransform: "capitalize" }}>{env.name}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: t.ink3, fontFamily: "'Geist Mono', monospace" }}>
                branch: {env.branch}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle on={env.autoMerge} small />
              <div>
                <div style={{ fontSize: 11.5, color: t.ink, fontWeight: 500 }}>Auto-merge</div>
                <div style={{ fontSize: 10.5, color: t.ink3, marginTop: 1 }}>
                  Merge PRs automatically after CI passes
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10,
              borderTop: `1px solid ${t.divider}`,
              fontSize: 11, color: t.ink3,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="1.5" y="2.5" width="8" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M3 4.5 L4 5.5 L5.5 4 M3 7 h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Environment variables
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable bits

const SearchInput = ({ value, onChange, placeholder }) => {
  const t = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 14px",
      background: t.popover,
      border: `1px solid ${t.border}`,
      borderRadius: 9,
    }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: t.ink3, flexShrink: 0 }}>
        <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8.7 8.7 L11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0,
          background: "transparent", border: "none", outline: "none",
          fontFamily: "inherit", fontSize: 12.5, color: t.ink,
        }}
      />
    </div>
  );
};

const Toggle = ({ on, onChange, small }) => {
  const t = useTheme();
  const w = small ? 32 : 38;
  const h = small ? 18 : 22;
  const knob = h - 4;
  return (
    <button onClick={onChange} style={{
      width: w, height: h, borderRadius: h,
      background: on ? t.success : t.border,
      border: "none", padding: 0,
      cursor: "pointer", position: "relative",
      transition: "background 0.15s",
      flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? w - knob - 2 : 2,
        width: knob, height: knob, borderRadius: "50%",
        background: "#ffffff",
        transition: "left 0.15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
      }} />
    </button>
  );
};

Object.assign(window, { SettingsGitHubView });
