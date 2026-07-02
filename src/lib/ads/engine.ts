import { db } from "@/lib/db";
import { complete } from "@/lib/llm/client";
import { resolveLlm } from "@/lib/llm/resolve";
import { parseJson } from "@/lib/agents/fallback";
import { loadBusinessContext } from "@/lib/executor/context";
import { ensureMcpBootstrapped } from "@/lib/mcp";

type Creative = { headline: string; body: string; cta: string };

/**
 * Plan + prepare an ad campaign: local market research (competitors) → creative
 * generation → persist AdCampaign (pending_approval) + AdCreatives → launch via
 * the guarded ads.launchCampaign tool (mandatory approval + budget caps).
 *
 * Validation gate: refuses to prepare paid acquisition if there's no site to
 * point at (avoids wasted spend — a Polsia failure mode we fix).
 */
export async function planAdCampaign(params: {
  businessId: string;
  userId: string;
  brief: string;
  platform?: "meta" | "google";
  dailyBudgetUsd?: number;
  durationDays?: number;
}) {
  const { businessId, userId } = params;
  const site = await db.generatedSite.findUnique({ where: { businessId } });
  if (!site) {
    return { ok: false, reason: "no_site", message: "Build a website before running ads (nowhere to send clicks)." };
  }

  const ctx = await loadBusinessContext(businessId);
  if (!ctx) return { ok: false, reason: "not_found" };

  const competitors = await db.competitor.findMany({
    where: { businessId },
    orderBy: { rating: "desc" },
    take: 5,
    select: { name: true, rating: true },
  });

  const creatives = await generateCreatives(ctx.name, ctx.type, params.brief, competitors, userId);

  const campaign = await db.adCampaign.create({
    data: {
      businessId,
      platform: params.platform ?? "meta",
      name: `${ctx.name} — ${params.brief.slice(0, 40)}`,
      objective: "traffic",
      status: "pending_approval",
      dailyBudgetUsd: params.dailyBudgetUsd ?? 20,
      creatives: {
        create: creatives.map((c) => ({ headline: c.headline, body: c.body, cta: c.cta })),
      },
    },
    include: { creatives: true },
  });

  // Route the actual launch through the guard (approval + caps).
  const mcp = ensureMcpBootstrapped();
  const launched = await mcp.invoke(
    "ads.launchCampaign",
    {
      adCampaignId: campaign.id,
      dailyBudgetUsd: campaign.dailyBudgetUsd ?? 20,
      durationDays: params.durationDays ?? 7,
    },
    { businessId, userId, dryRun: false }
  );

  return { ok: true, campaignId: campaign.id, creatives: campaign.creatives, launch: launched };
}

async function generateCreatives(
  name: string,
  type: string,
  brief: string,
  competitors: { name: string; rating: number | null }[],
  userId: string
): Promise<Creative[]> {
  const fallback: Creative[] = [
    {
      headline: `${name} — ${brief}`.slice(0, 40),
      body: `Discover ${name}, your local ${type.replace(/-/g, " ")}. Visit us today!`,
      cta: "Learn More",
    },
  ];
  const llm = await resolveLlm(userId);
  if (!llm) return fallback;

  try {
    const res = await complete(
      [
        { role: "system", content: "You output only valid JSON: an array of 3 objects with keys headline (<=40 chars), body (<=125 chars), cta." },
        {
          role: "user",
          content: `Business: ${name} (${type}). Campaign brief: ${brief}. Nearby competitors: ${competitors.map((c) => c.name).join(", ") || "unknown"}. Write 3 high-converting, locally-relevant ad creatives. JSON array only.`,
        },
      ],
      {
        provider: llm.provider,
        apiKey: llm.apiKey,
        model: llm.model ?? undefined,
        baseUrl: llm.baseUrl ?? undefined,
        maxTokens: 700,
        temperature: 0.8,
      }
    );
    const parsed = parseJson<Creative[]>(res.content, fallback);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 3) : fallback;
  } catch {
    return fallback;
  }
}

/** Compute ROAS from the spend ledger. */
export async function computeRoas(businessId: string): Promise<{
  spendUsd: number;
  conversions: number;
  clicks: number;
  impressions: number;
}> {
  const campaigns = await db.adCampaign.findMany({
    where: { businessId },
    select: { id: true },
  });
  const ids = campaigns.map((c) => c.id);
  if (ids.length === 0) return { spendUsd: 0, conversions: 0, clicks: 0, impressions: 0 };

  const events = await db.adSpendEvent.findMany({
    where: { adCampaignId: { in: ids } },
    select: { amountUsd: true, conversions: true, clicks: true, impressions: true },
  });
  return events.reduce(
    (acc, e) => ({
      spendUsd: acc.spendUsd + e.amountUsd,
      conversions: acc.conversions + (e.conversions ?? 0),
      clicks: acc.clicks + (e.clicks ?? 0),
      impressions: acc.impressions + (e.impressions ?? 0),
    }),
    { spendUsd: 0, conversions: 0, clicks: 0, impressions: 0 }
  );
}
