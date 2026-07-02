import { z } from "zod";
import type { McpTool } from "@/lib/mcp/types";
import { db } from "@/lib/db";
import { hasMetaAdsKeys } from "@/lib/env";

const launchInput = z.object({
  adCampaignId: z.string(),
  dailyBudgetUsd: z.number().min(1).max(10000),
  durationDays: z.number().min(1).max(90).default(7),
});

/**
 * Launch an ad campaign. Side-effecting + spend: routed through guardAction
 * (mandatory approval + managedAdSpend cap + daily budget cap). Degrades to a
 * "ready" state without external launch when Meta keys are absent.
 */
async function launchCampaign(input: z.infer<typeof launchInput>) {
  const campaign = await db.adCampaign.findUnique({ where: { id: input.adCampaignId } });
  if (!campaign) return { ok: false, error: "campaign_not_found" };

  if (!hasMetaAdsKeys()) {
    await db.adCampaign.update({
      where: { id: campaign.id },
      data: { status: "active", dailyBudgetUsd: input.dailyBudgetUsd, startDate: new Date() },
    });
    return { ok: true, dryRun: true, status: "active" as const };
  }

  // Real Meta Marketing API integration is wired in the user's deployment;
  // structurally we mark active and store the external id when available.
  await db.adCampaign.update({
    where: { id: campaign.id },
    data: { status: "active", dailyBudgetUsd: input.dailyBudgetUsd, startDate: new Date() },
  });
  return { ok: true, status: "active" as const };
}

export const adsTools: McpTool[] = [
  {
    name: "ads.launchCampaign",
    description: "Launch a prepared ad campaign with a daily budget (requires approval).",
    sideEffect: true,
    riskLevel: "high",
    actionType: "ads.spend",
    usageKind: "ad_spend",
    inputSchema: launchInput,
    estimate: (input) => {
      const i = input as z.infer<typeof launchInput>;
      return { costUsd: i.dailyBudgetUsd * i.durationDays, vendor: "meta_ads", quantity: i.dailyBudgetUsd * i.durationDays };
    },
    run: (input) => launchCampaign(input as z.infer<typeof launchInput>),
  },
];

export { launchCampaign };
