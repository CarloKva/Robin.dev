"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ClipboardList,
  Layers,
  Github,
  Activity,
  BarChart2,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI Agents",
    description:
      "Agenti autonomi sempre operativi che scrivono codice, aprono PR e iterano sul feedback automaticamente.",
    iconBg: "bg-violet-100 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: ClipboardList,
    title: "Task Management",
    description:
      "Crea e gestisci task in linguaggio naturale. Il backlog si aggiorna in tempo reale mentre gli agenti lavorano.",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: Layers,
    title: "Sprint Planning",
    description:
      "Organizza il lavoro in sprint come su Jira. Priorità, velocity e burndown sempre sotto controllo.",
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  {
    icon: Github,
    title: "GitHub Integration",
    description:
      "PR automatiche sul tuo repository. Review, commenti e merge gestiti direttamente dalla piattaforma.",
    iconBg: "bg-gray-100 dark:bg-gray-800/60",
    iconColor: "text-gray-700 dark:text-gray-300",
  },
  {
    icon: Activity,
    title: "Live Feed",
    description:
      "Monitora ogni azione dell'agente in tempo reale: commit, test, errori e decisioni architetturali.",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: BarChart2,
    title: "Reports & Metrics",
    description:
      "Metriche di produttività del team AI: task completate, tempo medio, velocity per sprint e trend nel tempo.",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setTimeout(() => setVisible(true), index * 50);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  const Icon = feature.icon;

  return (
    <div
      ref={ref}
      style={{
        transition: "opacity 400ms ease, transform 400ms ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div
        className="group h-full rounded-xl border border-border bg-white dark:bg-[#1C1C1E] p-6 shadow-sm"
        style={{
          transition: "transform 200ms ease, box-shadow 200ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform =
            "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 8px 24px rgba(0,0,0,0.10)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
        }}
      >
        <div
          className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full ${feature.iconBg}`}
        >
          <Icon
            className={`h-5 w-5 ${feature.iconColor}`}
            strokeWidth={1.5}
          />
        </div>
        <h3 className="mb-2 text-base font-semibold text-foreground">
          {feature.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

export default function FeaturesGrid() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Tutto quello che ti serve
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Una piattaforma completa per gestire agenti AI, sprint e repository.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <FeatureCard key={feature.title} feature={feature} index={index} />
        ))}
      </div>
    </section>
  );
}
