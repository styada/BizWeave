import { describe, expect, it } from "vitest";
import {
  outreachSchema,
  adsSchema,
  financeSchema,
  competitorResearchSchema,
  orchestratorSchema,
  parseWithSchema,
} from "@/lib/agents/contracts";
import {
  fallbackOutreach,
  fallbackAds,
  fallbackFinance,
  fallbackCompetitorResearch,
  fallbackOrchestrator,
} from "@/lib/agents/fallback";

const mockCtx = {
  id: "b1",
  name: "Test Business",
  type: "retail-general",
  inventory: [{ name: "Widget", price: 19.99 }],
};

describe("new agent schemas", () => {
  describe("outreachSchema", () => {
    it("parses valid outreach payload", () => {
      const raw = JSON.stringify({
        campaigns: [
          {
            name: "Welcome",
            channel: "email",
            subject: "Welcome!",
            body: "Thanks for joining us!",
            targetAudience: "New customers",
            schedule: "weekly",
          },
        ],
        templates: [{ name: "Follow-up", content: "Just checking in!" }],
      });
      const result = parseWithSchema(raw, outreachSchema, fallbackOutreach(mockCtx));
      expect(result.usedFallback).toBe(false);
      expect(result.value.campaigns[0].channel).toBe("email");
    });

    it("falls back on invalid outreach", () => {
      const result = parseWithSchema("bad data", outreachSchema, fallbackOutreach(mockCtx));
      expect(result.usedFallback).toBe(true);
      expect(result.value.campaigns).toHaveLength(1);
    });
  });

  describe("adsSchema", () => {
    it("parses valid ads payload", () => {
      const raw = JSON.stringify({
        platforms: ["google"],
        campaigns: [
          {
            name: "Search Ads",
            platform: "google",
            budget: "$500/mo",
            targetAudience: "Local",
            adCopy: "Visit us today!",
            startDate: "2025-07-01",
          },
        ],
        budget: { monthly: 1000, allocation: { google: 500 } },
      });
      const result = parseWithSchema(raw, adsSchema, fallbackAds(mockCtx));
      expect(result.usedFallback).toBe(false);
      expect(result.value.platforms).toContain("google");
    });

    it("falls back on invalid ads", () => {
      const result = parseWithSchema("{}", adsSchema, fallbackAds(mockCtx));
      expect(result.usedFallback).toBe(true);
    });
  });

  describe("financeSchema", () => {
    it("parses valid finance payload", () => {
      const raw = JSON.stringify({
        revenueStreams: [
          { name: "Sales", type: "product", estimatedMonthly: 5000 },
        ],
        pricingTiers: [
          { name: "Basic", price: 29.99, features: ["Feature A"] },
        ],
        metrics: {
          suggestedPricePoints: [19.99, 49.99],
          breakEvenEstimate: "3 months",
          growthIndicators: ["Repeat purchases"],
        },
      });
      const result = parseWithSchema(raw, financeSchema, fallbackFinance(mockCtx));
      expect(result.usedFallback).toBe(false);
      expect(result.value.revenueStreams[0].estimatedMonthly).toBe(5000);
    });

    it("falls back on invalid finance", () => {
      const result = parseWithSchema("{bad", financeSchema, fallbackFinance(mockCtx));
      expect(result.usedFallback).toBe(true);
    });
  });

  describe("competitorResearchSchema", () => {
    it("parses valid competitor research payload", () => {
      const raw = JSON.stringify({
        competitors: [
          {
            name: "CompCo",
            website: "https://compco.com",
            strengths: ["Brand"],
            weaknesses: ["Price"],
          },
        ],
        marketPositioning: {
          differentiators: ["Quality"],
          gaps: ["Online"],
          opportunities: ["SEO"],
        },
        pricingComparison: [
          { competitor: "CompCo", priceRange: "$10-$50", notes: "Premium" },
        ],
      });
      const result = parseWithSchema(
        raw,
        competitorResearchSchema,
        fallbackCompetitorResearch(mockCtx)
      );
      expect(result.usedFallback).toBe(false);
      expect(result.value.competitors[0].name).toBe("CompCo");
    });

    it("falls back on invalid competitor research", () => {
      const result = parseWithSchema(
        "nope",
        competitorResearchSchema,
        fallbackCompetitorResearch(mockCtx)
      );
      expect(result.usedFallback).toBe(true);
    });
  });

  describe("orchestratorSchema", () => {
    it("parses valid orchestrator payload", () => {
      const raw = JSON.stringify({
        plan: [
          {
            phase: "Foundation",
            agents: ["intake"],
            priority: 10,
            estimatedDuration: "1 day",
          },
        ],
        reasoning: "Start with intake to understand the business.",
        riskFlags: [],
      });
      const result = parseWithSchema(raw, orchestratorSchema, fallbackOrchestrator(mockCtx));
      expect(result.usedFallback).toBe(false);
      expect(result.value.plan[0].agents).toContain("intake");
    });

    it("falls back on invalid orchestrator", () => {
      const result = parseWithSchema("", orchestratorSchema, fallbackOrchestrator(mockCtx));
      expect(result.usedFallback).toBe(true);
    });
  });

  describe("fallback values", () => {
    it("fallbackOutreach generates valid structure", () => {
      const fb = fallbackOutreach(mockCtx);
      expect(fb.campaigns).toHaveLength(1);
      expect(fb.templates).toHaveLength(1);
    });

    it("fallbackAds generates valid structure", () => {
      const fb = fallbackAds(mockCtx);
      expect(fb.platforms).toContain("google");
      expect(fb.budget.monthly).toBeGreaterThan(0);
    });

    it("fallbackFinance generates valid structure", () => {
      const fb = fallbackFinance(mockCtx);
      expect(fb.revenueStreams).toHaveLength(1);
      expect(fb.metrics.suggestedPricePoints.length).toBeGreaterThan(0);
    });

    it("fallbackCompetitorResearch generates valid structure", () => {
      const fb = fallbackCompetitorResearch(mockCtx);
      expect(fb.competitors).toHaveLength(1);
      expect(fb.marketPositioning.differentiators.length).toBeGreaterThan(0);
    });

    it("fallbackOrchestrator generates valid structure", () => {
      const fb = fallbackOrchestrator(mockCtx);
      expect(fb.plan.length).toBeGreaterThan(0);
      expect(fb.reasoning).toContain("Standard");
    });

    it("fallback values pass their own schema validation", () => {
      const ctx = mockCtx;
      const checks = [
        { name: "outreach", schema: outreachSchema, fallback: fallbackOutreach(ctx) },
        { name: "ads", schema: adsSchema, fallback: fallbackAds(ctx) },
        { name: "finance", schema: financeSchema, fallback: fallbackFinance(ctx) },
        { name: "competitor-research", schema: competitorResearchSchema, fallback: fallbackCompetitorResearch(ctx) },
        { name: "orchestrator", schema: orchestratorSchema, fallback: fallbackOrchestrator(ctx) },
      ];
      for (const { name, schema, fallback } of checks) {
        const parsed = JSON.parse(JSON.stringify(fallback)); // bypass tryParseJson edge cases
        const result = schema.safeParse(parsed);
        expect(result.success, `${name} fallback failed schema: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      }
    });
  });
});
