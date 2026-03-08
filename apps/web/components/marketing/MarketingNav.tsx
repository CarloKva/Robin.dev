"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Prodotto", href: "#" },
  { label: "Prezzi", href: "#" },
  { label: "Docs", href: "#" },
  { label: "Blog", href: "#" },
];

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 h-14 backdrop-blur-xl transition-all duration-200",
        scrolled
          ? "bg-white/90 dark:bg-black/90 shadow-ios-sm border-b border-border"
          : "bg-white/60 dark:bg-black/60 border-b border-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#007AFF]">
            <span className="text-sm font-bold text-white">R</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Robin.dev
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/sign-in"
            className="rounded-md px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Accedi
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-[#007AFF] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Inizia gratis
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex items-center justify-center rounded-md p-2 text-foreground transition-colors hover:bg-accent md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Chiudi menu" : "Apri menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <div
        className={[
          "overflow-hidden transition-all duration-200 md:hidden",
          mobileOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
        style={{ transitionProperty: "max-height, opacity" }}
      >
        <div
          className={[
            "border-t border-border bg-white/95 dark:bg-black/95 px-4 py-3",
            scrolled ? "" : "backdrop-blur-xl",
          ].join(" ")}
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <Link
              href="/sign-in"
              className="rounded-md border border-border px-4 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent"
              onClick={() => setMobileOpen(false)}
            >
              Accedi
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-[#007AFF] px-4 py-2 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
              onClick={() => setMobileOpen(false)}
            >
              Inizia gratis
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
