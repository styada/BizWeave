"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#agents", label: "Agents" },
  { href: "#byok", label: "BYOK" },
  { href: "#use-cases", label: "Use cases" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "border-b border-white/10 bg-bg-elevated/95 shadow-lg"
          : "border-b border-transparent bg-transparent"
      } backdrop-blur-xl`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-glow)] text-sm font-bold text-[#0a0b0f] shadow-lg transition-transform group-hover:scale-105">
            B
          </div>
          <span className="text-lg font-semibold tracking-tight text-text-primary">Bizweave</span>
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-sm font-medium text-text-secondary transition-colors hover:text-text-primary after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-accent-primary after:transition-all hover:after:w-full"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">
              Start weaving
            </Button>
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-text-primary transition-colors hover:bg-white/5 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-bg-elevated/95 px-6 py-6 backdrop-blur-xl md:hidden">
          <div className="space-y-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="block text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)}>
              <Button className="w-full">Start weaving</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
