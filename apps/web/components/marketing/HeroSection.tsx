"use client";

import Link from "next/link";
import { Play } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F2F2F7] to-white dark:from-black dark:to-[#0a0a0a] px-6 pt-28 pb-16 text-center">
      {/* Decorative blur circle */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#007AFF]/6 blur-3xl" />

      <div className="relative mx-auto max-w-4xl">
        {/* Badge */}
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-foreground backdrop-blur"
          style={{ animation: "heroFadeUp 500ms ease both", animationDelay: "0ms" }}
        >
          {/* Anthropic icon placeholder */}
          <svg
            className="h-3.5 w-3.5 shrink-0 text-[#007AFF]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2L2 19.5h20L12 2zm0 4.5l6.5 11h-13L12 6.5z" />
          </svg>
          Powered by Claude Code
        </div>

        {/* Tagline */}
        <h1
          className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl"
          style={{ animation: "heroFadeUp 500ms ease both", animationDelay: "100ms" }}
        >
          Il tuo team di AI agents,{" "}
          <span className="text-[#007AFF]">sempre operativo</span>
        </h1>

        {/* Subtitle */}
        <p
          className="mx-auto mb-10 max-w-2xl text-base text-muted-foreground sm:text-lg"
          style={{ animation: "heroFadeUp 500ms ease both", animationDelay: "200ms" }}
        >
          Robin.dev assegna i tuoi task di sviluppo ad agenti AI, apre pull request
          e mantiene il backlog in movimento — così puoi concentrarti su ciò che conta.
        </p>

        {/* CTA buttons */}
        <div
          className="mb-16 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          style={{ animation: "heroFadeUp 500ms ease both", animationDelay: "300ms" }}
        >
          <Link
            href="/sign-up"
            className="flex h-12 items-center rounded-xl bg-[#007AFF] px-8 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Inizia gratis
          </Link>
          <button
            type="button"
            className="flex h-12 items-center gap-2 rounded-xl border border-border bg-transparent px-8 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Play className="h-4 w-4 fill-current" />
            Guarda la demo
          </button>
        </div>

        {/* Browser mockup */}
        <div
          className="mx-auto max-w-4xl"
          style={{ animation: "heroFadeUp 500ms ease both", animationDelay: "400ms" }}
        >
          <div
            className="group relative rounded-xl border border-border bg-white dark:bg-[#0d0d0d] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)]"
            style={{
              transform: "perspective(1200px) rotateX(4deg) rotateY(-2deg) scale(0.98)",
              transition: "transform 600ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "perspective(1200px) rotateX(4deg) rotateY(-2deg) scale(0.98)";
            }}
          >
            {/* Chrome bar */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
              {/* Traffic lights */}
              <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
              <span className="h-3 w-3 rounded-full bg-[#28C840]" />
              {/* URL bar */}
              <div className="ml-3 flex flex-1 items-center rounded-md bg-[#F2F2F7] dark:bg-white/5 px-3 py-1">
                <span className="truncate text-xs text-muted-foreground">
                  app.robin.dev/dashboard
                </span>
              </div>
            </div>

            {/* Screenshot area */}
            <div className="relative aspect-[16/9] overflow-hidden rounded-b-xl">
              {/* Placeholder — swap with <Image> when screenshot is ready */}
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#F9F9F9] dark:bg-[#111]">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#007AFF]">
                  <span className="text-lg font-bold text-white">R</span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Robin.dev — Dashboard
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Screenshot placeholder
                </p>
              </div>

              {/* Bottom gradient fade */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white dark:from-[#0d0d0d] to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
