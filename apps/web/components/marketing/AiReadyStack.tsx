"use client";

import { useEffect, useRef, useState } from "react";

const stackItems = [
  {
    name: "Next.js",
    role: "Frontend Framework",
    logo: (
      <svg viewBox="0 0 180 180" className="h-8 w-8" aria-hidden="true">
        <mask id="mask0_408_134" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
          <circle cx="90" cy="90" r="90" fill="black" />
        </mask>
        <g mask="url(#mask0_408_134)">
          <circle cx="90" cy="90" r="90" fill="black" />
          <path d="M149.508 157.52L69.142 54H54V125.97H66.1404V69.3832L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#paint0_linear_408_134)" />
          <rect x="115" y="54" width="12" height="72" fill="url(#paint1_linear_408_134)" />
        </g>
        <defs>
          <linearGradient id="paint0_linear_408_134" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="paint1_linear_408_134" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
    logoBg: "bg-black",
  },
  {
    name: "Supabase",
    role: "Database & Auth",
    logo: (
      <svg viewBox="0 0 109 113" className="h-8 w-8" aria-hidden="true" fill="none">
        <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347Z" fill="url(#supabase_a)" />
        <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347Z" fill="url(#supabase_b)" fillOpacity=".2" />
        <path d="M45.317 2.071C48.177-1.53 53.976.443 54.044 5.041l.753 67.251H9.581c-8.19 0-12.758-9.46-7.665-15.875L45.317 2.071Z" fill="#3ECF8E" />
        <defs>
          <linearGradient id="supabase_a" x1="53.974" y1="54.974" x2="94.163" y2="71.829" gradientUnits="userSpaceOnUse">
            <stop stopColor="#249361" />
            <stop offset="1" stopColor="#3ECF8E" />
          </linearGradient>
          <linearGradient id="supabase_b" x1="36.156" y1="30.578" x2="54.484" y2="65.081" gradientUnits="userSpaceOnUse">
            <stop />
            <stop offset="1" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
    logoBg: "bg-[#1C1C1C]",
  },
  {
    name: "Vercel",
    role: "Deployment & Hosting",
    logo: (
      <svg viewBox="0 0 76 65" className="h-7 w-7" aria-hidden="true" fill="currentColor">
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" className="fill-white" />
      </svg>
    ),
    logoBg: "bg-black",
  },
  {
    name: "GitHub",
    role: "Version Control & CI/CD",
    logo: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true" fill="currentColor">
        <path className="fill-white" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
    logoBg: "bg-[#24292e]",
  },
  {
    name: "GitLab",
    role: "CI/CD Pipelines",
    logo: (
      <svg viewBox="0 0 380 380" className="h-8 w-8" aria-hidden="true" fill="none">
        <path d="M189.97 352.1L264.1 117.3H115.85L189.97 352.1Z" fill="#E24329" />
        <path d="M189.97 352.1L115.85 117.3L32.71 117.3L189.97 352.1Z" fill="#FC6D26" />
        <path d="M32.71 117.3L10.78 183.33C8.92 188.91 10.9 195.05 15.68 198.56L189.97 352.1L32.71 117.3Z" fill="#FCA326" />
        <path d="M32.71 117.3H115.85L80.24 5.93C78.1 -0.79 68.71 -0.79 66.57 5.93L32.71 117.3Z" fill="#E24329" />
        <path d="M189.97 352.1L264.1 117.3L347.23 117.3L189.97 352.1Z" fill="#FC6D26" />
        <path d="M347.23 117.3L369.16 183.33C371.02 188.91 369.04 195.05 364.26 198.56L189.97 352.1L347.23 117.3Z" fill="#FCA326" />
        <path d="M347.23 117.3H264.1L299.7 5.93C301.84 -0.79 311.23 -0.79 313.37 5.93L347.23 117.3Z" fill="#E24329" />
      </svg>
    ),
    logoBg: "bg-[#2E2E2E]",
  },
  {
    name: "Prisma",
    role: "Database ORM",
    logo: (
      <svg viewBox="0 0 30 30" className="h-7 w-7" aria-hidden="true" fill="currentColor">
        <path className="fill-white" d="M28.462 21.855L16.738.89a1.92 1.92 0 00-3.333 0L1.538 21.855a1.92 1.92 0 00.393 2.396l11.156 9.304a1.92 1.92 0 002.337 0l11.156-9.304a1.92 1.92 0 00.393-2.396zm-13.3 8.156L4.318 21.855l9.71-19.42 1.135 2.27v16.51l-1.001 8.796z" />
      </svg>
    ),
    logoBg: "bg-[#0C3249]",
  },
  {
    name: "TypeScript",
    role: "Type-Safe Development",
    logo: (
      <svg viewBox="0 0 400 400" className="h-8 w-8" aria-hidden="true">
        <rect width="400" height="400" rx="50" fill="#3178C6" />
        <path d="M87.7 200.7V213H175V371h37.5V213H300V201c0-6.7-.1-12.3-.3-12.5-.2-.3-48.5-.4-107-.4l-106.6.2v12.4z" fill="white" />
        <path d="M338.2 200.5c-9.4 2.5-16.2 8.6-19.2 17.3-1.5 4.4-1.8 6.5-1.4 10 .7 7.2 3.6 12.8 8.7 16.8 2.9 2.2 11 6.2 18 8.6 6.7 2.3 12.8 5.4 14.5 7.5 3.1 3.8 1.6 9.3-3.1 11.6-3.9 2-14.6 2-18.1 0-5-2.8-8-7.2-9.2-13.5l-.7-3.5H314l-.1 3c-.4 15.2 8.1 24.4 25.6 28.1 6.4 1.4 21.3.9 27.5-1 9.5-2.8 16.3-9.7 18.5-18.9 1.3-5.4.5-14.9-1.7-19.5-3.7-7.9-10.8-13-25.6-18.5-8.7-3.2-12.2-5.3-13.9-7.8-1.4-2.1-1.3-6 .1-7.8 2.7-3.2 10.7-4.1 15.8-1.8 4.1 1.8 6.6 5.3 7.4 10.4l.5 3.4h14.3l-.1-2.7c-.3-8.3-4-15-10.7-19.7-5.6-3.9-17.2-6.2-24-4.5z" fill="white" />
      </svg>
    ),
    logoBg: "bg-[#1a1a2e]",
  },
  {
    name: "Clerk",
    role: "Authentication",
    logo: (
      <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true" fill="none">
        <circle cx="20" cy="20" r="20" fill="#6C47FF" />
        <circle cx="20" cy="15" r="6" fill="white" />
        <path d="M8 34c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    logoBg: "bg-[#1a1040]",
  },
];

function StackCard({
  item,
  index,
}: {
  item: (typeof stackItems)[number];
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
          setTimeout(() => setVisible(true), index * 60);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div
      ref={ref}
      style={{
        transition: "opacity 400ms ease, transform 400ms ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white dark:bg-[#1C1C1E] px-5 py-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-xl ${item.logoBg}`}
        >
          {item.logo}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.role}</p>
        </div>
      </div>
    </div>
  );
}

export default function AiReadyStack() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="mb-12 text-center">
        <span className="mb-3 inline-block rounded-full border border-border bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
          Zero Setup
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Stack preconfigurato e pronto all&rsquo;uso
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Gli agenti Robin.dev vengono già forniti con tutti gli strumenti
          integrati. Nessuna configurazione manuale richiesta.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
        {stackItems.map((item, index) => (
          <StackCard key={item.name} item={item} index={index} />
        ))}
      </div>
    </section>
  );
}
