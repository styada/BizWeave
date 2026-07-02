"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-32 pt-20 md:pt-28">
      {/* Sophisticated gradient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% -10%, rgba(232,184,74,0.12), transparent),
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(94,234,212,0.08), transparent),
            radial-gradient(ellipse 50% 60% at 20% 80%, rgba(129,140,248,0.06), transparent)
          `,
        }}
      />
      
      <div className="relative mx-auto max-w-5xl text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-primary/20 bg-gradient-to-r from-accent-primary/10 to-accent-secondary/10 px-5 py-2 text-xs font-semibold tracking-wide text-accent-primary backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            For businesses that already exist
          </span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          className="mt-10 font-serif text-5xl font-normal leading-[1.05] tracking-tight text-text-primary md:text-7xl lg:text-8xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        >
          Your business, woven online
          <br />
          <span className="bg-gradient-to-r from-accent-primary via-accent-glow to-accent-secondary bg-clip-text text-transparent">
            while you sleep
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-text-secondary md:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Own a liquor store, boutique, or SaaS product? Connect your inventory and
          brand. AI agents build your site, run marketing, and handle support — with a
          safeguard agent as your last line of defense.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link href="/signup">
            <Button size="lg" className="group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                Start weaving free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
          </Link>
          <a href="#agents">
            <Button variant="outline" size="lg">
              Meet your AI team
            </Button>
          </a>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          className="mt-10 flex items-center justify-center gap-6 text-sm text-text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <span className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-safeguard" />
            Safeguard review
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-accent-primary" />
            BYOK for OpenAI & Anthropic
          </span>
          <span>No credit card required</span>
        </motion.div>
      </div>
    </section>
  );
}
