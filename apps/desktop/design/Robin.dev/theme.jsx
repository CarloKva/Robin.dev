// Theme tokens — light is canonical. Dark kept as opt-in (legacy / preference).
// Pull tokens via TH global; switch via setTheme('light'|'dark').

const LIGHT = {
  mode: "light",

  // Surfaces — warm bone palette, not stark white
  bg: "#f4f1e9",              // canvas / app shell (outside popover)
  popover: "#fcfaf5",         // popover surface
  popoverEdge: "#ffffff",     // top-edge highlight of popover (subtle)
  panel: "#f3efe5",           // recessed panel inside popover
  hover: "#ece7d8",
  inset: "#ebe6d6",           // input field bg

  // Borders — warm taupe, soft
  divider: "#e6e0cd",         // between rows
  border: "#d8d1ba",
  borderStrong: "#c5bda1",
  shadow: "rgba(85, 65, 30, 0.10)",
  shadowStrong: "rgba(60, 40, 10, 0.20)",

  // Text
  ink: "#1a1612",             // primary
  ink2: "#4d463c",            // secondary
  ink3: "#7a7263",            // muted / labels
  ink4: "#a59c89",            // placeholder
  monoColor: "#5a5346",

  // Accent — Robin coral, deep enough for AA on cream
  accent: "#d63916",
  accentHover: "#bd2f10",
  accentInk: "#fff7f3",       // text on accent button
  accentSoft: "#fbe2d6",
  accentBorder: "#f0b699",

  // Status — used for badges, dots, soft bg tints
  success: "#15803d",
  successSoft: "#d8f0dc",
  successBorder: "#a3d4a8",

  warning: "#a16207",         // amber-700 — for "blocked / needs you"
  warningSoft: "#fbecc4",
  warningBorder: "#e6c870",

  danger: "#b91c1c",
  dangerSoft: "#fbdada",
  dangerBorder: "#e5a5a5",

  info: "#6d28d9",            // violet — review / PR
  infoSoft: "#ebe2fb",
  infoBorder: "#c8b6ed",

  neutral: "#7a7263",
  neutralSoft: "#ece6d4",
};

const DARK = {
  mode: "dark",

  bg: "#0d0c0a",
  popover: "#171612",
  popoverEdge: "#22201b",
  panel: "#1e1c17",
  hover: "#27241e",
  inset: "#1a1814",

  divider: "#26231d",
  border: "#312d24",
  borderStrong: "#403b30",
  shadow: "rgba(0,0,0,0.55)",
  shadowStrong: "rgba(0,0,0,0.7)",

  ink: "#f4f1e9",
  ink2: "#bdb5a1",
  ink3: "#857c69",
  ink4: "#5d5749",
  monoColor: "#bdb5a1",

  accent: "#ff7d4d",
  accentHover: "#ff9466",
  accentInk: "#1a0a05",
  accentSoft: "rgba(255,125,77,0.14)",
  accentBorder: "rgba(255,125,77,0.32)",

  success: "#4ade80",
  successSoft: "rgba(74,222,128,0.10)",
  successBorder: "rgba(74,222,128,0.25)",

  warning: "#fbbf24",
  warningSoft: "rgba(251,191,36,0.10)",
  warningBorder: "rgba(251,191,36,0.28)",

  danger: "#f87171",
  dangerSoft: "rgba(248,113,113,0.10)",
  dangerBorder: "rgba(248,113,113,0.25)",

  info: "#a78bfa",
  infoSoft: "rgba(167,139,250,0.10)",
  infoBorder: "rgba(167,139,250,0.28)",

  neutral: "#857c69",
  neutralSoft: "rgba(133,124,105,0.10)",
};

// global live token store + simple subscribe API
window.__robinTheme = LIGHT;
const themeSubs = new Set();
window.setTheme = (mode) => {
  window.__robinTheme = mode === "dark" ? DARK : LIGHT;
  themeSubs.forEach(fn => fn(window.__robinTheme));
};
window.subscribeTheme = (fn) => { themeSubs.add(fn); return () => themeSubs.delete(fn); };

// Hook for React components
function useTheme() {
  const [t, setT] = React.useState(window.__robinTheme);
  React.useEffect(() => window.subscribeTheme(setT), []);
  return t;
}
window.useTheme = useTheme;
window.LIGHT_THEME = LIGHT;
window.DARK_THEME = DARK;
