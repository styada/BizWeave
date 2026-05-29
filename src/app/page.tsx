import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Hammer,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  ClipboardList,
  Key,
  Store,
  Cloud,
  Wine,
} from "lucide-react";

const agents = [
  {
    icon: ClipboardList,
    name: "Intake",
    desc: "Ingests your store name, location, inventory, and brand voice.",
  },
  {
    icon: Brain,
    name: "Planner",
    desc: "Maps site structure, content themes, and go-to-market timeline.",
  },
  {
    icon: Hammer,
    name: "Builder",
    desc: "Ships a production-ready, mobile-first website from your data.",
  },
  {
    icon: Megaphone,
    name: "Marketing",
    desc: "Drafts campaigns across SEO, social, and email channels.",
  },
  {
    icon: MessageCircle,
    name: "Support",
    desc: "Creates FAQs and auto-replies for customer inquiries.",
  },
  {
    icon: ShieldCheck,
    name: "Safeguard",
    desc: "Last-bastion review — nothing goes live without passing policy checks.",
    highlight: true,
  },
];

const steps = [
  { n: "01", title: "Connect", desc: "Tell us your business type, location, and inventory — or SaaS positioning." },
  { n: "02", title: "Weave", desc: "Six specialized agents collaborate to plan, build, and market your presence." },
  { n: "03", title: "Review", desc: "Safeguard agent audits every output before anything publishes." },
  { n: "04", title: "Run", desc: "Your site goes live. Marketing and support templates keep working." },
];

const useCases = [
  {
    icon: Wine,
    title: "Liquor & specialty retail",
    desc: "Upload inventory CSV, add your license location. Age-gated site with product grid.",
  },
  {
    icon: Store,
    title: "Local retail & restaurants",
    desc: "Hours, menu items, and neighborhood SEO — woven from what you already have.",
  },
  {
    icon: Cloud,
    title: "SaaS & digital products",
    desc: "Feature lists, pricing tiers, and landing pages built for conversion.",
  },
];

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />

        <section className="border-y border-white/[0.06] py-8">
          <p className="text-center text-sm text-[var(--text-muted)]">
            Built for stores, SaaS, and services — not just startups
          </p>
        </section>

        <section id="how-it-works" className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl md:text-4xl text-center">How Bizweave works</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[var(--text-secondary)]">
              From existing business data to a running web presence — fully agent-driven.
            </p>
            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <article key={s.n} className="glass rounded-2xl p-6">
                  <span className="text-3xl font-serif text-[var(--accent-primary)]">{s.n}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="agents" className="bg-[var(--bg-elevated)] px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl md:text-4xl text-center">Your AI team</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[var(--text-secondary)]">
              One orchestrated pipeline. Every role covered. Safeguard has final say.
            </p>
            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => (
                <article
                  key={a.name}
                  className={`rounded-2xl border p-6 ${
                    a.highlight
                      ? "border-[var(--safeguard)]/40 bg-[var(--safeguard)]/5"
                      : "border-white/[0.06] bg-[var(--bg-surface)]"
                  }`}
                >
                  <a.icon
                    className={`h-8 w-8 ${
                      a.highlight ? "text-[var(--safeguard)]" : "text-[var(--accent-primary)]"
                    }`}
                  />
                  <h3 className="mt-4 font-semibold">{a.name} Agent</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{a.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="byok" className="px-6 py-24">
          <div className="mx-auto max-w-4xl text-center">
            <Key className="mx-auto h-12 w-12 text-[var(--accent-primary)]" />
            <h2 className="mt-6 font-serif text-3xl md:text-4xl">Bring your own keys</h2>
            <p className="mt-4 text-[var(--text-secondary)]">
              Connect OpenAI or Anthropic API keys. They&apos;re encrypted at rest with AES-256-GCM.
              You control cost, model choice, and data — we never train on your content.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <span className="rounded-full border border-white/10 px-4 py-2 text-sm font-mono">
                gpt-4o-mini
              </span>
              <span className="rounded-full border border-white/10 px-4 py-2 text-sm font-mono">
                claude-3-5-haiku
              </span>
              <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-[var(--text-muted)]">
                + your preferred models
              </span>
            </div>
          </div>
        </section>

        <section id="use-cases" className="bg-[var(--bg-elevated)] px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl md:text-4xl text-center">Built for real businesses</h2>
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {useCases.map((u) => (
                <article key={u.title} className="glass rounded-2xl p-8">
                  <u.icon className="h-10 w-10 text-[var(--accent-secondary)]" />
                  <h3 className="mt-4 text-lg font-semibold">{u.title}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{u.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--accent-primary)]/20 bg-gradient-to-b from-[var(--accent-primary)]/10 to-transparent p-12 text-center">
            <h2 className="font-serif text-3xl md:text-4xl">
              Start weaving tonight
            </h2>
            <p className="mt-4 text-[var(--text-secondary)]">
              No credit card required. Connect your API key when you&apos;re ready for full LLM power.
            </p>
            <Link href="/signup" className="mt-8 inline-block">
              <Button size="lg">Get started free</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-6 py-12 text-center text-sm text-[var(--text-muted)]">
        <p>© {new Date().getFullYear()} Bizweave. Your business, woven online.</p>
      </footer>
    </>
  );
}
