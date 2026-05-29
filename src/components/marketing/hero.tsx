"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-16 md:pt-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(232,184,74,0.15), transparent)",
        }}
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-1.5 text-xs font-medium text-[var(--accent-primary)]">
            <Sparkles className="h-3.5 w-3.5" />
            For businesses that already exist
          </span>
        </motion.div>

        <motion.h1
          className="mt-8 font-serif text-4xl font-normal leading-[1.1] tracking-tight text-[var(--text-primary)] md:text-6xl lg:text-7xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Your business, woven online
          <br />
          <span className="text-[var(--accent-primary)]">while you sleep</span>
        </motion.h1>

        <motion.p
          className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Own a liquor store, boutique, or SaaS product? Connect your inventory and
          brand. AI agents build your site, run marketing, and handle support — with a
          safeguard agent as your last line of defense.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link href="/signup">
            <Button size="lg" className="group">
              Start weaving free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <a href="#agents">
            <Button variant="secondary" size="lg">
              Meet your AI team
            </Button>
          </a>
        </motion.div>

        <motion.p
          className="mt-6 text-sm text-[var(--text-muted)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          BYOK for OpenAI & Anthropic · No credit card required
        </motion.p>
      </div>
    </section>
  );
}
