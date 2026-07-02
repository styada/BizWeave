"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LayoutDashboard,
  Plus,
  Settings,
  Key,
  Activity,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/onboarding", label: "New business", icon: Plus },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/settings/keys", label: "API Keys", icon: Key },
];

export function DashboardSidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-primary to-accent-glow text-sm font-bold text-[#0a0b0f]">
          B
        </div>
        <span className="font-semibold text-text-primary">Bizweave</span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition relative",
                active
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent-primary" />
              )}
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        {userName && (
          <p className="mb-3 truncate px-4 text-xs text-text-muted">
            {userName}
          </p>
        )}
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-text-secondary transition hover:bg-white/5 hover:text-text-primary"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        className="fixed left-4 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary shadow-lg ring-1 ring-white/10 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close sidebar" : "Open sidebar"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar (always visible) */}
      <aside className="hidden md:flex md:w-[280px] md:shrink-0 md:flex-col md:border-r md:border-white/10 md:bg-bg-elevated">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-bg-elevated shadow-2xl transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
