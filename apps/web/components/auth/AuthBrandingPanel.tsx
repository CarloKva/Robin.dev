"use client";

import { useEffect, useState } from "react";
import { GitPullRequest, Bot, Github } from "lucide-react";

const FEATURES = [
  { icon: GitPullRequest, label: "PR automatiche" },
  { icon: Bot, label: "Agenti sempre attivi" },
  { icon: Github, label: "Integrazione GitHub" },
];

export default function AuthBrandingPanel() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="relative hidden h-full flex-col overflow-hidden bg-gradient-to-b from-[#1C1C1E] to-black lg:flex"
      style={{
        transform: visible ? "translateX(0)" : "translateX(-100%)",
        opacity: visible ? 1 : 0,
        transition: "transform 400ms ease-out, opacity 400ms ease-out",
      }}
    >
      {/* Background product screenshot overlay */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-10 blur-sm"
        style={{ backgroundImage: "url('/og-preview.png')" }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-full flex-col p-10">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#007AFF]">
            <span className="text-base font-bold text-white">R</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            Robin.dev
          </span>
        </div>

        {/* Center content */}
        <div className="flex flex-1 flex-col items-start justify-center gap-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
              Il tuo team di sviluppo AI
            </h1>
            <p className="mt-3 text-base text-white/60">
              Agenti Claude Code che aprono PR, gestiscono task e si integrano
              con il tuo workflow in modo automatico.
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white/80">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
