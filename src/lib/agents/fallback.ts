import type {
  AgentId,
  BusinessContext,
  IntakeOutput,
  MarketingOutput,
  PlannerOutput,
  SiteOutput,
  SafeguardVerdict,
  SupportOutput,
  OutreachOutput,
  AdsOutput,
  FinanceOutput,
  CompetitorResearchOutput,
  OrchestratorOutput,
} from "./types";

export function fallbackIntake(ctx: BusinessContext): IntakeOutput {
  return {
    persona: `Local customers seeking ${ctx.type} services from ${ctx.name}`,
    valueProps: [
      `Trusted ${ctx.type} at ${ctx.location ?? "your area"}`,
      `${ctx.inventory.length} products ready to browse`,
      "Convenient hours and friendly service",
    ],
    tone: "warm, professional, community-focused",
    competitorHints: ["local selection", "competitive pricing", "customer service"],
    constraints: ctx.type.includes("alcohol") ? ["age-restricted", "ID required"] : [],
  };
}

export function fallbackPlan(ctx: BusinessContext): PlannerOutput {
  return {
    siteStructure: {
      pages: [
        {
          slug: "home",
          title: ctx.name,
          sections: ["hero", "products", "about", "contact"],
        },
      ],
      primaryCTA: "Visit Us Today",
      colorMood: "dark premium with gold accents",
    },
    contentThemes: ["quality", "local community", "selection"],
    marketingAngles: ["local SEO", "social media", "email newsletter"],
    timeline: [
      { phase: "Launch", duration: "Week 1", actions: ["Publish site", "Google Business"] },
      { phase: "Growth", duration: "Weeks 2-4", actions: ["Social campaigns", "Email"] },
    ],
  };
}

export function fallbackSite(ctx: BusinessContext): SiteOutput {
  const products = ctx.inventory
    .slice(0, 12)
    .map(
      (item) => `
    <article class="product-card">
      <h3>${escapeHtml(item.name)}</h3>
      ${item.category ? `<span class="category">${escapeHtml(item.category)}</span>` : ""}
      ${item.price != null ? `<p class="price">$${item.price.toFixed(2)}</p>` : ""}
    </article>`
    )
    .join("");

  const ageGate =
    ctx.type === "retail-liquor"
      ? `<p class="age-notice">Must be 21+ to purchase. Please drink responsibly.</p>`
      : "";

  const html = `
    <header class="hero">
      <h1>${escapeHtml(ctx.name)}</h1>
      <p class="tagline">${escapeHtml(ctx.tagline ?? `Your trusted ${ctx.type.replace(/-/g, " ")}`)}</p>
      ${ageGate}
      <a href="#contact" class="cta">Get in Touch</a>
    </header>
    <section id="products" class="products">
      <h2>Our Selection</h2>
      <div class="product-grid">${products || "<p>Browse our full selection in store.</p>"}</div>
    </section>
    <section id="about" class="about">
      <h2>About Us</h2>
      <p>${escapeHtml(ctx.description ?? `Welcome to ${ctx.name}. We're proud to serve our community with quality products and exceptional service.`)}</p>
    </section>
    <section id="contact" class="contact">
      <h2>Visit Us</h2>
      ${ctx.location ? `<p class="address">${escapeHtml(ctx.location)}</p>` : ""}
      ${ctx.phone ? `<p class="phone"><a href="tel:${ctx.phone}">${escapeHtml(ctx.phone)}</a></p>` : ""}
      ${ctx.email ? `<p class="email"><a href="mailto:${ctx.email}">${escapeHtml(ctx.email)}</a></p>` : ""}
    </section>
    <footer><p>&copy; ${new Date().getFullYear()} ${escapeHtml(ctx.name)}. Powered by Bizweave.</p></footer>
  `;

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0a0b0f; color: #f4f4f5; line-height: 1.6; }
    .hero { padding: 4rem 2rem; text-align: center; background: linear-gradient(180deg, rgba(232,184,74,0.12), transparent); }
    .hero h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .tagline { color: #a1a1aa; font-size: 1.25rem; margin-bottom: 1.5rem; }
    .age-notice { color: #fbbf24; font-size: 0.875rem; margin: 1rem 0; }
    .cta { display: inline-block; background: #e8b84a; color: #0a0b0f; padding: 0.75rem 2rem; border-radius: 10px; text-decoration: none; font-weight: 600; }
    section { padding: 3rem 2rem; max-width: 1100px; margin: 0 auto; }
    h2 { font-size: 1.75rem; margin-bottom: 1.5rem; color: #e8b84a; }
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .product-card { background: #1a1d28; padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); }
    .product-card h3 { font-size: 1rem; margin-bottom: 0.5rem; }
    .category { font-size: 0.75rem; color: #5eead4; }
    .price { color: #e8b84a; font-weight: 600; margin-top: 0.5rem; }
    .contact p { margin: 0.5rem 0; }
    .contact a { color: #5eead4; }
    footer { text-align: center; padding: 2rem; color: #71717a; font-size: 0.875rem; border-top: 1px solid rgba(255,255,255,0.06); }
  `;

  return {
    html,
    css,
    meta: {
      title: `${ctx.name} | Official Site`,
      description: ctx.description ?? `Visit ${ctx.name}${ctx.location ? ` at ${ctx.location}` : ""}.`,
    },
  };
}

export function fallbackMarketing(ctx: BusinessContext): MarketingOutput {
  return {
    channels: ["google", "instagram", "email"],
    campaigns: [
      {
        name: "Grand Opening",
        channel: "instagram",
        content: `🎉 ${ctx.name} is now online! Visit us${ctx.location ? ` at ${ctx.location}` : ""} for our full selection.`,
        schedule: "launch",
      },
      {
        name: "Weekly Highlights",
        channel: "email",
        content: `This week at ${ctx.name}: new arrivals and specials. Stop by or browse online.`,
        schedule: "weekly",
      },
    ],
    seoKeywords: [
      ctx.name.toLowerCase(),
      ctx.type.replace(/-/g, " "),
      ctx.location?.split(",")[0]?.toLowerCase() ?? "local",
      "near me",
    ].filter(Boolean) as string[],
  };
}

export function fallbackSupport(ctx: BusinessContext): SupportOutput {
  return {
    faqs: [
      { question: "What are your hours?", answer: "Please contact us directly for current hours." },
      { question: "Where are you located?", answer: ctx.location ?? "Contact us for location details." },
    ],
    autoReplies: [
      { trigger: "hours", response: "Thanks for reaching out! We'll share our current hours shortly." },
    ],
    escalationRules: ["Refund requests", "Complaints", "Bulk orders"],
  };
}

export function fallbackSafeguard(approved = true): SafeguardVerdict {
  return {
    approved,
    issues: approved ? [] : ["Demo mode — connect your API key for full safeguard review"],
    revisions: approved ? [] : ["Add BYOK API key in Settings"],
    summary: approved
      ? "All outputs passed baseline policy checks (demo mode)."
      : "Full safeguard review requires a connected LLM API key.",
    reliabilityIndex: approved ? 86 : 62,
    scores: {
      safety: approved ? 90 : 68,
      consistency: approved ? 84 : 60,
      channelReadiness: approved ? 83 : 58,
    },
    differentiatorInsight:
      "Trust Index highlights release readiness before publish so owners can act on concrete risks.",
  };
}

export function fallbackOutreach(ctx: BusinessContext): OutreachOutput {
  return {
    campaigns: [
      {
        name: "Welcome Campaign",
        channel: "email",
        subject: `Welcome to ${ctx.name}!`,
        body: `Hi there,\n\nThanks for your interest in ${ctx.name}. We're thrilled to serve you.\n\nBest,\nThe ${ctx.name} Team`,
        targetAudience: "New customers and prospects",
        schedule: "weekly",
      },
    ],
    templates: [
      {
        name: "Follow-up",
        content: `Hi {{name}},\n\nJust checking in! Let us know if you have any questions.\n\n${ctx.name}`,
      },
    ],
  };
}

export function fallbackAds(ctx: BusinessContext): AdsOutput {
  return {
    platforms: ["google", "meta"],
    campaigns: [
      {
        name: `${ctx.name} - General Awareness`,
        platform: "google",
        budget: "$500/month",
        targetAudience: `Local customers interested in ${ctx.type}`,
        adCopy: `Discover ${ctx.name} — your trusted ${ctx.type}${ctx.location ? ` in ${ctx.location}` : ""}. Visit us today!`,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      },
    ],
    budget: {
      monthly: 1000,
      allocation: { google: 500, meta: 300, linkedin: 200 },
    },
  };
}

export function fallbackFinance(ctx: BusinessContext): FinanceOutput {
  return {
    revenueStreams: [
      {
        name: `${ctx.type} sales`,
        type: "product",
        estimatedMonthly: ctx.inventory.length * 50,
      },
    ],
    pricingTiers: [
      {
        name: "Standard",
        price: ctx.inventory[0]?.price ?? 29.99,
        features: ["Full product range", "Standard support"],
      },
    ],
    metrics: {
      suggestedPricePoints: [19.99, 39.99, 59.99],
      breakEvenEstimate: "~3-6 months based on average transaction volume",
      growthIndicators: ["Local market penetration", "Repeat customer rate", "Seasonal demand"],
    },
  };
}

export function fallbackCompetitorResearch(ctx: BusinessContext): CompetitorResearchOutput {
  return {
    competitors: [
      {
        name: "Local competitors",
        website: "https://example.competitor.local",
        strengths: ["Established presence", "Existing customer base"],
        weaknesses: ["Limited online presence", "No digital marketing"],
        estimatedTraffic: "Unknown (brick-and-mortar focused)",
      },
    ],
    marketPositioning: {
      differentiators: [`Personalized ${ctx.type} experience`, "Modern digital presence"],
      gaps: ["Limited online ordering", "No loyalty program"],
      opportunities: ["Build local SEO", "Social media engagement", "Email marketing"],
    },
    pricingComparison: [
      {
        competitor: "Local average",
        priceRange: "$10-$100",
        notes: "Based on general market data — verify locally",
      },
    ],
  };
}

export function fallbackOrchestrator(ctx: BusinessContext): OrchestratorOutput {
  return {
    plan: [
      {
        phase: "Foundation",
        agents: ["intake", "planner"] as AgentId[],
        priority: 10,
        estimatedDuration: "1 day",
      },
      {
        phase: "Creation",
        agents: ["builder", "marketing", "support"] as AgentId[],
        priority: 8,
        estimatedDuration: "1-2 days",
      },
      {
        phase: "Review",
        agents: ["safeguard"] as AgentId[],
        priority: 6,
        estimatedDuration: "1 day",
      },
      {
        phase: "Growth",
        agents: ["outreach", "ads", "finance", "competitor-research"] as AgentId[],
        priority: 4,
        estimatedDuration: "3-5 days",
      },
    ],
    reasoning: `Standard orchestration plan for ${ctx.name} (${ctx.type}). Foundation first, then creation, review, and growth phases.`,
    riskFlags: [],
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}
