// Avatar Workshop — character configurator. Polished studio feel.
// Uses Dicebear v9 adventurer SVGs with graceful fallback.

const SKIN_COLORS = ["9e5622", "b9785b", "ecad80", "f2d3b1", "fcdcb5"];
const HAIR_COLORS = ["0e0e0e", "3eac2c", "562306", "85c2c6", "ab2a18", "ac6511", "afafaf", "b9a05f", "cb6820", "dba3be", "e5d7a3", "ecdcbf"];
const BG_COLORS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "ffd5a8", "c4f4d0", "ffb6b6"];

const HAIR_VARIANTS = Array.from({ length: 24 }, (_, i) =>
  "variant" + String(i + 1).padStart(2, "0"));
const EYES_VARIANTS = Array.from({ length: 26 }, (_, i) =>
  "variant" + String(i + 1).padStart(2, "0"));
const MOUTH_VARIANTS = Array.from({ length: 30 }, (_, i) =>
  "variant" + String(i + 1).padStart(2, "0"));
const EYEBROW_VARIANTS = Array.from({ length: 15 }, (_, i) =>
  "variant" + String(i + 1).padStart(2, "0"));

const DICEBEAR_VERSION = "9.x";

// Build Dicebear URL — defaults to SVG, can request PNG with size.
function buildAvatarUrl(cfg, size = 200, format = "svg") {
  const p = new URLSearchParams();
  p.set("seed", cfg.seed);
  if (cfg.hair) p.set("hair", cfg.hair);
  if (cfg.eyes) p.set("eyes", cfg.eyes);
  if (cfg.mouth) p.set("mouth", cfg.mouth);
  if (cfg.eyebrows) p.set("eyebrows", cfg.eyebrows);
  if (cfg.skinColor) p.set("skinColor", cfg.skinColor);
  if (cfg.hairColor) p.set("hairColor", cfg.hairColor);
  if (cfg.glasses) {
    p.set("glasses", cfg.glasses);
    p.set("glassesProbability", 100);
  } else {
    p.set("glassesProbability", 0);
  }
  if (cfg.earrings) {
    p.set("earrings", cfg.earrings);
    p.set("earringsProbability", 100);
  } else {
    p.set("earringsProbability", 0);
  }
  if (cfg.features && cfg.features !== "") {
    p.set("features", cfg.features);
    p.set("featuresProbability", 100);
  } else {
    p.set("featuresProbability", 0);
  }
  p.set("backgroundColor", cfg.backgroundColor || "transparent");
  if (format === "png") p.set("size", size);
  return `https://api.dicebear.com/${DICEBEAR_VERSION}/${cfg.style || "adventurer"}/${format}?` + p.toString();
}

// Default config per agent — seeded variations so they look distinct.
const DEFAULT_CFG = {
  agt_01: { style: "adventurer", seed: "aria",   hair: "variant05", eyes: "variant03", mouth: "variant10", eyebrows: "variant04", skinColor: "f2d3b1", hairColor: "0e0e0e", backgroundColor: "b6e3f4", features: "freckles" },
  agt_02: { style: "adventurer", seed: "marcus", hair: "variant14", eyes: "variant08", mouth: "variant15", eyebrows: "variant09", skinColor: "b9785b", hairColor: "562306", backgroundColor: "d1d4f9", glasses: "variant02" },
  agt_03: { style: "adventurer", seed: "yuki",   hair: "variant09", eyes: "variant12", mouth: "variant07", eyebrows: "variant07", skinColor: "f2d3b1", hairColor: "0e0e0e", backgroundColor: "ffd5a8" },
  agt_04: { style: "adventurer", seed: "nora",   hair: "variant21", eyes: "variant05", mouth: "variant20", eyebrows: "variant03", skinColor: "ecad80", hairColor: "ac6511", backgroundColor: "ffd5dc", features: "blush" },
  agt_05: { style: "adventurer", seed: "theo",   hair: "variant03", eyes: "variant11", mouth: "variant05", eyebrows: "variant02", skinColor: "fcdcb5", hairColor: "b9a05f", backgroundColor: "c0aede", glasses: "variant04" },
  agt_06: { style: "adventurer", seed: "sofia",  hair: "variant18", eyes: "variant09", mouth: "variant18", eyebrows: "variant08", skinColor: "ecad80", hairColor: "0e0e0e", backgroundColor: "ffb6b6", earrings: "variant03" },
};

const cycle = (arr, current, dir = 1) => {
  const i = arr.indexOf(current);
  const n = i === -1 ? 0 : (i + dir + arr.length) % arr.length;
  return arr[n];
};
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─────────────────────────────────────────────────────────────────────────────
// Robust image: tries SVG, falls back to colored gradient + initials if it fails.

const DicebearImg = ({ cfg, size = 80, initials, hue, alt, style }) => {
  const t = useTheme();
  const [errored, setErrored] = React.useState(false);
  const url = buildAvatarUrl(cfg, size);
  if (errored || !cfg.seed) {
    return (
      <div style={{
        width: "100%", height: "100%",
        background: `linear-gradient(135deg, hsl(${hue || 200},60%,55%), hsl(${(hue || 200) + 22},65%,46%))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700,
        fontSize: size * 0.32,
        ...style,
      }}>{initials || "?"}</div>
    );
  }
  return (
    <img src={url} alt={alt || "avatar"}
      onError={() => setErrored(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }} />
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const AvatarWorkshopView = () => {
  const t = useTheme();
  const [activeId, setActiveId] = React.useState("agt_01");
  const [configs, setConfigs] = React.useState(DEFAULT_CFG);
  const cfg = configs[activeId];
  const agent = getAgent(activeId);
  const update = (patch) => setConfigs(c => ({ ...c, [activeId]: { ...c[activeId], ...patch } }));
  const randomize = () => {
    update({
      hair: rand(HAIR_VARIANTS),
      eyes: rand(EYES_VARIANTS),
      mouth: rand(MOUTH_VARIANTS),
      eyebrows: rand(EYEBROW_VARIANTS),
      skinColor: rand(SKIN_COLORS),
      hairColor: rand(HAIR_COLORS),
      features: ["", "blush", "freckles", "mustache"][Math.floor(Math.random() * 4)],
      glasses: Math.random() > 0.6 ? "variant0" + (1 + Math.floor(Math.random() * 5)) : null,
      earrings: Math.random() > 0.7 ? "variant0" + (1 + Math.floor(Math.random() * 6)) : null,
      backgroundColor: rand(BG_COLORS),
    });
  };
  const reset = () => update(DEFAULT_CFG[activeId]);

  return (
    <WindowShell title="Robin.dev · Avatar Workshop" subtitle={`Customize ${agent.name.split(" ")[0]}`} width={1100} height={680}
      toolbar={<>
        <Btn variant="ghost" size="md">Cancel</Btn>
        <Btn variant="primary" size="md" icon={
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 5.5 L4.5 8 L9 3" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        }>Save look</Btn>
      </>}>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "200px 1fr 340px", minHeight: 0 }}>
        <EngineerRail agents={MOCK_AGENTS} configs={configs} activeId={activeId} onSelect={setActiveId} />
        <Studio cfg={cfg} agent={agent} onRandomize={randomize} onReset={reset} />
        <ConfigPanel cfg={cfg} onChange={update} agent={agent} />
      </div>
    </WindowShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Engineer rail

const EngineerRail = ({ agents, configs, activeId, onSelect }) => {
  const t = useTheme();
  return (
    <div style={{
      borderRight: `1px solid ${t.divider}`,
      background: t.panel,
      display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <div style={{ padding: "14px 16px 8px", fontSize: 10.5, fontWeight: 600, color: t.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>
        Engineers
      </div>
      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
        {agents.map(a => {
          const active = a.id === activeId;
          return (
            <button key={a.id} onClick={() => onSelect(a.id)} style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "8px 10px",
              background: active ? t.popover : "transparent",
              border: "none", borderRadius: 9, cursor: "pointer",
              fontFamily: "inherit", textAlign: "left",
              marginBottom: 2,
              boxShadow: active ? `0 1px 2px rgba(85,65,30,0.08), 0 0 0 1px ${t.divider}` : "none",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.hover; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              <span style={{
                width: 32, height: 32, borderRadius: "50%",
                background: `#${configs[a.id].backgroundColor}`,
                overflow: "hidden", flexShrink: 0,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
              }}>
                <DicebearImg cfg={configs[a.id]} size={64} initials={a.initials} hue={a.hue} alt={a.name} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.name.split(" ")[0]}
                </div>
                <div style={{ fontSize: 10.5, color: t.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.role}
                </div>
              </div>
              {active && (
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: t.accent, flexShrink: 0 }}>
                  <path d="M3 2 L7 5 L3 8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Studio — main preview area

const Studio = ({ cfg, agent, onRandomize, onReset }) => {
  const t = useTheme();
  const bg = cfg.backgroundColor || "f0eee5";
  return (
    <div style={{
      position: "relative",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px",
      minHeight: 0,
      overflow: "hidden",
      background: t.popover,
    }}>
      {/* soft studio backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 38%, #${bg} 0%, ${t.popover} 60%)`,
        opacity: 0.6,
      }} />
      {/* grid floor */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: "45%",
        background: `linear-gradient(180deg, transparent, ${t.panel} 80%)`,
        opacity: 0.5,
      }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center" }}>
        {/* avatar stage */}
        <div style={{
          position: "relative",
          width: 280, height: 320,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          marginBottom: 8,
        }}>
          {/* concentric floor rings */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: "absolute", bottom: 10 + i * 4,
              width: 240 - i * 30, height: 32 - i * 6,
              borderRadius: "50%",
              border: `1.5px solid hsl(${agent.hue}, 50%, 60%, ${0.32 - i * 0.08})`,
              pointerEvents: "none",
            }} />
          ))}
          {/* contact shadow */}
          <div style={{
            position: "absolute", bottom: 22,
            width: 220, height: 24,
            background: `radial-gradient(ellipse, hsl(${agent.hue}, 50%, 30%, 0.32), transparent 70%)`,
            filter: "blur(4px)",
          }} />
          {/* avatar circle */}
          <div style={{
            position: "absolute", bottom: 22,
            width: 240, height: 240,
            borderRadius: "50%",
            background: `linear-gradient(180deg, #${bg}, hsl(${agent.hue}, 50%, 75%))`,
            boxShadow:
              "inset 0 -16px 36px rgba(0,0,0,0.10)," +
              "inset 0 2px 0 rgba(255,255,255,0.55)," +
              "0 22px 40px rgba(60,40,10,0.15)," +
              "0 0 0 6px rgba(255,255,255,0.6)," +
              `0 0 0 7px hsl(${agent.hue}, 50%, 70%, 0.4)`,
            overflow: "hidden",
            animation: "robinFloat 4s ease-in-out infinite",
          }}>
            <DicebearImg cfg={cfg} size={480} initials={agent.initials} hue={agent.hue} alt={agent.name} />
          </div>
        </div>

        {/* identity */}
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <div style={{ fontSize: 19, fontWeight: 600, color: t.ink, letterSpacing: -0.2 }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 12.5, color: t.ink3, marginTop: 4 }}>
            {agent.role} · {agent.workstation.location}
          </div>
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <Btn variant="secondary" size="md" onClick={onRandomize} icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1.5" y="1.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="4" cy="4" r="0.8" fill="currentColor"/>
              <circle cx="8" cy="4" r="0.8" fill="currentColor"/>
              <circle cx="6" cy="6" r="0.8" fill="currentColor"/>
              <circle cx="4" cy="8" r="0.8" fill="currentColor"/>
              <circle cx="8" cy="8" r="0.8" fill="currentColor"/>
            </svg>
          }>Randomize</Btn>
          <Btn variant="ghost" size="md" onClick={onReset} icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 6 a4 4 0 1 1 -1.2 -2.8 M10 1 v2.5 h-2.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }>Reset</Btn>
        </div>
      </div>

      <style>{`
        @keyframes robinFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Config panel

const ConfigPanel = ({ cfg, onChange, agent }) => {
  const t = useTheme();
  const [tab, setTab] = React.useState("face");

  return (
    <div style={{
      borderLeft: `1px solid ${t.divider}`,
      background: t.popover,
      display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <div style={{ display: "flex", padding: "0 14px", gap: 2, borderBottom: `1px solid ${t.divider}` }}>
        <ConfigTab id="face" tab={tab} setTab={setTab}>Face</ConfigTab>
        <ConfigTab id="hair" tab={tab} setTab={setTab}>Hair</ConfigTab>
        <ConfigTab id="extras" tab={tab} setTab={setTab}>Extras</ConfigTab>
      </div>

      <div className="robin-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 16px 20px" }}>
        {tab === "face" && <>
          <CategorySection label="Eyes" current={cfg.eyes}>
            <VariantStrip value={cfg.eyes} options={EYES_VARIANTS} cfg={cfg} agent={agent} field="eyes" onChange={onChange} />
          </CategorySection>
          <CategorySection label="Mouth" current={cfg.mouth}>
            <VariantStrip value={cfg.mouth} options={MOUTH_VARIANTS} cfg={cfg} agent={agent} field="mouth" onChange={onChange} />
          </CategorySection>
          <CategorySection label="Eyebrows" current={cfg.eyebrows}>
            <VariantStrip value={cfg.eyebrows} options={EYEBROW_VARIANTS} cfg={cfg} agent={agent} field="eyebrows" onChange={onChange} />
          </CategorySection>
          <CategorySection label="Skin tone">
            <ColorRow value={cfg.skinColor} options={SKIN_COLORS} onChange={(v) => onChange({ skinColor: v })} />
          </CategorySection>
        </>}

        {tab === "hair" && <>
          <CategorySection label="Style" current={cfg.hair}>
            <VariantStrip value={cfg.hair} options={HAIR_VARIANTS} cfg={cfg} agent={agent} field="hair" onChange={onChange} />
          </CategorySection>
          <CategorySection label="Color">
            <ColorRow value={cfg.hairColor} options={HAIR_COLORS} onChange={(v) => onChange({ hairColor: v })} />
          </CategorySection>
        </>}

        {tab === "extras" && <>
          <CategorySection label="Glasses">
            <ToggleStrip
              none
              value={cfg.glasses}
              options={["variant01", "variant02", "variant03", "variant04", "variant05"]}
              onChange={(v) => onChange({ glasses: v })}
              renderPreview={(opt) => ({ ...cfg, glasses: opt })}
              agent={agent}
            />
          </CategorySection>
          <CategorySection label="Earrings">
            <ToggleStrip
              none
              value={cfg.earrings}
              options={["variant01", "variant02", "variant03", "variant04", "variant05", "variant06"]}
              onChange={(v) => onChange({ earrings: v })}
              renderPreview={(opt) => ({ ...cfg, earrings: opt })}
              agent={agent}
            />
          </CategorySection>
          <CategorySection label="Features">
            <FeatureRow value={cfg.features || ""} onChange={(v) => onChange({ features: v })} />
          </CategorySection>
          <CategorySection label="Background">
            <ColorRow value={cfg.backgroundColor} options={BG_COLORS} onChange={(v) => onChange({ backgroundColor: v })} />
          </CategorySection>
        </>}
      </div>
    </div>
  );
};

const ConfigTab = ({ id, tab, setTab, children }) => {
  const t = useTheme();
  const active = id === tab;
  return (
    <button onClick={() => setTab(id)} style={{
      background: "transparent", border: "none",
      padding: "11px 12px 13px",
      fontFamily: "inherit", fontSize: 12.5,
      color: active ? t.ink : t.ink3,
      fontWeight: active ? 600 : 500,
      cursor: "pointer", position: "relative",
    }}>
      {children}
      {active && (
        <span style={{
          position: "absolute", left: 10, right: 10, bottom: -1, height: 2,
          background: t.accent, borderRadius: 2,
        }} />
      )}
    </button>
  );
};

const CategorySection = ({ label, current, children }) => {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        <span style={{
          fontSize: 11, color: t.ink2, fontWeight: 600,
        }}>{label}</span>
        {current && (
          <span style={{ fontSize: 10, color: t.ink4, fontFamily: "'Geist Mono', monospace" }}>
            · {current.replace("variant", "")}
          </span>
        )}
      </div>
      {children}
    </div>
  );
};

const VariantStrip = ({ value, options, cfg, agent, field, onChange }) => {
  const idx = Math.max(0, options.indexOf(value));
  const windowSize = 4;
  const start = Math.max(0, Math.min(idx - 1, options.length - windowSize));
  const view = options.slice(start, start + windowSize);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <PagerBtn onClick={() => onChange({ [field]: cycle(options, value, -1) })}>
        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M7 2 L3 5.5 L7 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </PagerBtn>
      <div style={{ flex: 1, display: "flex", gap: 6, overflow: "hidden", justifyContent: "space-between" }}>
        {view.map(opt => (
          <PreviewTile key={opt}
            active={opt === value}
            onClick={() => onChange({ [field]: opt })}
            cfg={{ ...cfg, [field]: opt }}
            agent={agent} />
        ))}
      </div>
      <PagerBtn onClick={() => onChange({ [field]: cycle(options, value, 1) })}>
        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M4 2 L8 5.5 L4 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </PagerBtn>
    </div>
  );
};

const ToggleStrip = ({ value, options, onChange, renderPreview, agent, none }) => {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {none && (
        <PreviewTile active={!value} onClick={() => onChange(null)} placeholder="none" agent={agent} />
      )}
      {options.map(opt => (
        <PreviewTile key={opt}
          active={opt === value}
          onClick={() => onChange(opt)}
          cfg={renderPreview(opt)}
          agent={agent} />
      ))}
    </div>
  );
};

const PreviewTile = ({ active, onClick, cfg, agent, placeholder }) => {
  const t = useTheme();
  return (
    <button onClick={onClick} style={{
      width: 54, height: 54, padding: 0,
      borderRadius: 10,
      background: cfg ? `#${cfg.backgroundColor || "f0eee5"}` : t.panel,
      border: `2px solid ${active ? t.accent : t.divider}`,
      cursor: "pointer",
      overflow: "hidden",
      position: "relative",
      transition: "transform 0.08s, border-color 0.12s",
    }}
    onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.95)"}
    onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
    onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
      {cfg ? (
        <DicebearImg cfg={cfg} size={108} initials={agent?.initials} hue={agent?.hue} />
      ) : (
        <span style={{ fontSize: 10, color: t.ink3, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", height: "100%" }}>{placeholder}</span>
      )}
      {active && (
        <span style={{
          position: "absolute", top: 3, right: 3,
          width: 16, height: 16, borderRadius: "50%",
          background: t.accent, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}>
          <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2 4.5 L4 6.5 L7 2.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      )}
    </button>
  );
};

const PagerBtn = ({ children, onClick }) => {
  const t = useTheme();
  return (
    <button onClick={onClick} style={{
      width: 26, height: 26, borderRadius: 7,
      background: t.panel, border: "none",
      color: t.ink2, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontFamily: "inherit",
      transition: "background 0.12s",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = t.hover}
    onMouseLeave={(e) => e.currentTarget.style.background = t.panel}>{children}</button>
  );
};

const ColorRow = ({ value, options, onChange }) => {
  const t = useTheme();
  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      {options.map(c => {
        const active = c === value;
        return (
          <button key={c} onClick={() => onChange(c)} style={{
            width: 30, height: 30, borderRadius: "50%",
            background: `#${c}`,
            border: active ? `2.5px solid ${t.accent}` : `1.5px solid ${t.divider}`,
            cursor: "pointer", padding: 0,
            boxShadow: active ? `inset 0 0 0 2px ${t.popover}, 0 2px 6px rgba(0,0,0,0.15)` : "0 1px 2px rgba(0,0,0,0.06)",
            transition: "transform 0.08s",
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.92)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"} />
        );
      })}
    </div>
  );
};

const FeatureRow = ({ value, onChange }) => {
  const t = useTheme();
  const options = [
    { id: "", label: "None" },
    { id: "blush", label: "Blush" },
    { id: "freckles", label: "Freckles" },
    { id: "mustache", label: "Mustache" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(opt => {
        const active = (value || "") === opt.id;
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} style={{
            padding: "6px 12px", borderRadius: 999,
            background: active ? t.accentSoft : t.panel,
            color: active ? t.accent : t.ink2,
            border: "none",
            fontSize: 12, fontFamily: "inherit",
            fontWeight: active ? 600 : 500,
            cursor: "pointer", whiteSpace: "nowrap",
          }}>{opt.label}</button>
        );
      })}
    </div>
  );
};

Object.assign(window, { AvatarWorkshopView, buildAvatarUrl, DEFAULT_CFG, DicebearImg });
