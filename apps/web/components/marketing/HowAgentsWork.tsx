"use client";

import { useEffect, useRef, useState } from "react";
import {
  PlusSquare,
  Cpu,
  GitPullRequest,
  CheckCircle2,
  Server,
} from "lucide-react";

const steps = [
  {
    icon: PlusSquare,
    step: "01",
    title: "Crei un task",
    description:
      "Descrivi cosa vuoi fare in linguaggio naturale. Niente ticket complicati — basta un'idea chiara.",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: Cpu,
    step: "02",
    title: "Robin assegna un agente",
    description:
      "Un agente dedicato — una VM isolata con tutto l'ambiente di sviluppo già pronto — riceve il task in pochi secondi.",
    iconBg: "bg-violet-100 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Server,
    step: "03",
    title: "L'agente lavora nella VM",
    description:
      "L'agente scrive codice, installa dipendenze, esegue build e test — tutto all'interno della sua macchina virtuale, senza toccare il tuo ambiente.",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: GitPullRequest,
    step: "04",
    title: "Il risultato arriva come PR",
    description:
      "Quando il lavoro è fatto, l'agente apre una pull request sul tuo repository. Tu fai review e mergi — o chiedi modifiche.",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
];

function StepCard({
  step,
  index,
  isLast,
}: {
  step: (typeof steps)[number];
  index: number;
  isLast: boolean;
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
          setTimeout(() => setVisible(true), index * 80);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  const Icon = step.icon;

  return (
    <div
      ref={ref}
      className="relative flex flex-col items-center text-center"
      style={{
        transition: "opacity 400ms ease, transform 400ms ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {/* Connector line between steps (hidden on last) */}
      {!isLast && (
        <div className="absolute left-1/2 top-10 hidden h-px w-full translate-x-[2.75rem] border-t border-dashed border-border lg:block" />
      )}

      {/* Icon circle */}
      <div
        className={`relative z-10 mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full border border-border bg-white dark:bg-[#1C1C1E] shadow-sm ${step.iconBg}`}
      >
        <Icon className={`h-8 w-8 ${step.iconColor}`} strokeWidth={1.5} />
        {/* Step badge */}
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#007AFF] text-[10px] font-bold text-white">
          {step.step}
        </span>
      </div>

      <h3 className="mb-2 text-base font-semibold text-foreground">
        {step.title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>
    </div>
  );
}

export default function HowAgentsWork() {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [badgeVisible, setBadgeVisible] = useState(false);

  useEffect(() => {
    const el = badgeRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setBadgeVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      {/* Section header */}
      <div
        ref={badgeRef}
        className="mb-16 text-center"
        style={{
          transition: "opacity 400ms ease, transform 400ms ease",
          opacity: badgeVisible ? 1 : 0,
          transform: badgeVisible ? "translateY(0)" : "translateY(12px)",
        }}
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#007AFF]" />
          Zero setup. Pronto in secondi.
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Come funzionano gli Agenti
        </h2>
        <p className="mt-4 mx-auto max-w-2xl text-base text-muted-foreground">
          Ogni agente è una{" "}
          <span className="font-medium text-foreground">
            macchina virtuale isolata
          </span>{" "}
          con un ambiente di sviluppo preconfigurato e pronto all&apos;uso.
          Niente setup manuale — l&apos;agente è operativo immediatamente.
        </p>
      </div>

      {/* Steps grid */}
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {steps.map((step, index) => (
          <StepCard
            key={step.step}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
          />
        ))}
      </div>

      {/* VM callout card */}
      <div className="mt-14 rounded-xl border border-border bg-white dark:bg-[#1C1C1E] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#007AFF]/10">
            <Server className="h-6 w-6 text-[#007AFF]" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              VM preconfigurata — tutto già installato
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ogni agente gira su una macchina virtuale dedicata con Node.js,
              Python, Git e le principali dipendenze già disponibili. Ha accesso
              diretto al tuo repository, può eseguire build, test e linter in
              autonomia. Tu non installi nulla, non configuri nulla — Robin
              pensa a tutto.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
