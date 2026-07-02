import { db } from "@/lib/db";
import { computeRoas } from "@/lib/ads/engine";
import { resolveLlm } from "@/lib/llm/resolve";
import { complete } from "@/lib/llm/client";
import { flags } from "@/lib/env";

export type DreamProposal = {
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
  kpiTarget?: string;
};

export type DreamResult = {
  businessId: string;
  mood: "healthy" | "attention" | "critical";
  proposals: DreamProposal[];
  brief: string;
};

/**
 * Nightly "dreaming" reflection: analyze KPIs, propose improvements, emit a
 * morning brief + mood signal for the dashboard.
 */
export async function runDreamingCycle(businessId: string, userId: string): Promise<DreamResult> {
  if (!flags.dreaming) {
    return {
      businessId,
      mood: "healthy",
      proposals: [],
      brief: "Dreaming is disabled (FEATURE_DREAMING=false).",
    };
  }

  const [business, roas, pendingApprovals, failedTasks] = await Promise.all([
    db.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    computeRoas(businessId),
    db.pendingAction.count({ where: { businessId, status: "pending" } }),
    db.agentTask.count({ where: { businessId, status: "failed", completedAt: { gte: daysAgo(1) } } }),
  ]);

  const mood: DreamResult["mood"] =
    failedTasks > 2 || pendingApprovals > 5
      ? "critical"
      : pendingApprovals > 0 || roas.spendUsd > 0 && roas.conversions === 0
        ? "attention"
        : "healthy";

  const proposals: DreamProposal[] = [];
  if (roas.spendUsd > 50 && roas.conversions === 0) {
    proposals.push({
      title: "Review ad creative",
      detail: "Ad spend is active but conversions are zero. Consider new copy or pausing spend.",
      priority: "high",
      kpiTarget: "ad_conversions",
    });
  }
  if (pendingApprovals > 0) {
    proposals.push({
      title: "Clear approval queue",
      detail: `${pendingApprovals} action(s) awaiting your approval.`,
      priority: "medium",
      kpiTarget: "approvals",
    });
  }

  const brief = await generateBrief(business?.name ?? "your business", mood, proposals, userId);

  for (const p of proposals) {
    await db.featureRequest
      .create({
        data: {
          businessId,
          source: "agent_dream",
          title: p.title,
          detail: p.detail,
          status: "triage",
        },
      })
      .catch(() => undefined);
  }

  await db.activityEvent
    .create({
      data: {
        businessId,
        eventType: "dreaming",
        level: mood === "critical" ? "warn" : "info",
        message: brief.slice(0, 500),
        payload: JSON.stringify({ mood, proposalCount: proposals.length }),
      },
    })
    .catch(() => undefined);

  // Phase D: land the brief in the operator chat as a Message from the agent
  // on the most recent web conversation, or create a new one. Channel-tagged
  // "digest" so the UI can render it distinctly.
  try {
    const conv =
      (await db.conversation.findFirst({
        where: { businessId, channel: "web" },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      })) ??
      (await db.conversation.create({
        data: { businessId, channel: "web" },
        select: { id: true },
      }));
    if (conv) {
      await db.message.create({
        data: {
          conversationId: conv.id,
          role: "agent",
          content: brief,
          // Channel is encoded in the content prefix for the chat UI to detect.
        },
      });
    }
  } catch {
    // Chat persistence is best-effort; never fail the dreaming cycle over it.
  }

  return { businessId, mood, proposals, brief };
}

async function generateBrief(
  name: string,
  mood: DreamResult["mood"],
  proposals: DreamProposal[],
  userId: string
): Promise<string> {
  const fallback = `Good morning! ${name} is ${mood}. ${proposals.length} improvement(s) suggested.`;
  const llm = await resolveLlm(userId);
  if (!llm) return fallback;
  try {
    const res = await complete(
      [
        { role: "system", content: "Write a concise morning brief for a local business owner (3-4 sentences)." },
        {
          role: "user",
          content: `Business: ${name}. Mood: ${mood}. Proposals: ${JSON.stringify(proposals)}`,
        },
      ],
      { provider: llm.provider, apiKey: llm.apiKey, maxTokens: 300, temperature: 0.6 }
    );
    return res.content.trim() || fallback;
  } catch {
    return fallback;
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
