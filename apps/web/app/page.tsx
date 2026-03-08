import FeaturesGrid from "@/components/marketing/FeaturesGrid";
import MarketingNav from "@/components/marketing/MarketingNav";
import HeroSection from "@/components/marketing/HeroSection";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNav />
      <HeroSection />

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-100">
              <svg
                className="h-5 w-5 text-brand-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-sm font-semibold">AI agents</h3>
            <p className="text-sm text-muted-foreground">
              Assign tasks to AI agents that write code, open PRs, and iterate
              on feedback automatically.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-100">
              <svg
                className="h-5 w-5 text-brand-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-sm font-semibold">Task management</h3>
            <p className="text-sm text-muted-foreground">
              Manage your backlog and sprints in one place. Prioritise work and
              track progress in real time.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-100">
              <svg
                className="h-5 w-5 text-brand-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-sm font-semibold">Live metrics</h3>
            <p className="text-sm text-muted-foreground">
              Monitor agent activity, task throughput, and team velocity from a
              unified dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <FeaturesGrid />

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Robin.dev. All rights reserved.
      </footer>
    </div>
  );
}
