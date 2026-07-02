import { db } from "@/lib/db";
import { computeRoas } from "@/lib/ads/engine";

/**
 * Hermes-style reward scoring: evaluate actions against real business KPIs
 * (calls, ROAS, outreach, tasks) and update skill reward scores.
 */
export async function scoreTaskOutcome(params: {
  businessId: string;
  skillId?: string;
  taskId?: string;
  intent: string;
}): Promise<{ reward: number; kpiDeltas: Record<string, number> }> {
  const kpiDeltas: Record<string, number> = {};

  if (/receptionist|voice|call/.test(params.intent)) {
    const calls = await db.callLog.count({
      where: { businessId: params.businessId, occurredAt: { gte: daysAgo(7) } },
    });
    kpiDeltas.callsAnswered = calls;
  }

  if (/ad|campaign/.test(params.intent)) {
    const roas = await computeRoas(params.businessId);
    kpiDeltas.adSpendUsd = roas.spendUsd;
    kpiDeltas.adClicks = roas.clicks;
    kpiDeltas.adConversions = roas.conversions;
  }

  if (/outreach|email|sms|campaign/.test(params.intent)) {
    const sent = await db.campaignSend.count({
      where: {
        campaign: { businessId: params.businessId },
        status: "sent",
        sentAt: { gte: daysAgo(7) },
      },
    });
    kpiDeltas.messagesSent = sent;
  }

  const reward = normalizeReward(kpiDeltas);

  if (params.skillId) {
    await db.evaluation.create({
      data: {
        skillId: params.skillId,
        taskId: params.taskId,
        reward,
        kpiDeltas,
      },
    });
    await db.skill.update({
      where: { id: params.skillId },
      data: {
        rewardScore: { increment: reward * 0.1 },
        runCount: { increment: 1 },
      },
    });
  }

  return { reward, kpiDeltas };
}

function normalizeReward(deltas: Record<string, number>): number {
  const values = Object.values(deltas);
  if (values.length === 0) return 0.5;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.min(1, Math.max(0, sum > 0 ? 0.5 + Math.log10(sum + 1) * 0.2 : 0.3));
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
