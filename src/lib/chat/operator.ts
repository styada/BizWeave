import { db } from "@/lib/db";
import { complete } from "@/lib/llm/client";
import { resolveLlm } from "@/lib/llm/resolve";
import { loadBusinessContext } from "@/lib/executor/context";
import { runTask } from "@/lib/executor/router";
import { addMemory, retrieveMemory, memoryToPromptBlock } from "@/lib/memory/store";
import { buildRagContext } from "@/lib/rag/context";
import { matchSkill } from "@/lib/planner/match";
import { planAdCampaign } from "@/lib/ads/engine";
import { setupReceptionist } from "@/lib/voice/receptionist";
import { refreshCompetitors } from "@/lib/competitors/refresh";

export type OperatorIntent =
  | "build_website"
  | "publish_site"
  | "run_ads"
  | "create_receptionist"
  | "outreach"
  | "competitor_intel"
  | "generic_task"
  | "question";

export type OperatorReply = {
  conversationId: string;
  reply: string;
  intent: OperatorIntent;
  taskId?: string;
  featureRequestId?: string;
};

/** Fast heuristic intent classifier (LLM refine optional in future). */
export function classifyIntent(text: string): OperatorIntent {
  const t = text.toLowerCase().trim();
  if (/\b(publish|ship|launch|go live|take it live)\b/.test(t)) return "publish_site";
  if (/(build|make|create|redo|update).*(web ?site|landing|page|site)/.test(t))
    return "build_website";
  if (/\b(ad|ads|advertis|campaign|boost|promote)\b/.test(t)) return "run_ads";
  if (/(receptionist|answer.*(call|phone)|phone agent|voice)/.test(t))
    return "create_receptionist";
  if (/(email|newsletter|sms|text|outreach|loyalty|members?hip|social post)/.test(t))
    return "outreach";
  if (/(competitor|competition|nearby|market research|who else)/.test(t))
    return "competitor_intel";
  if (/^(what|who|when|where|why|how|is|are|do|does|can|should|tell me)/.test(t))
    return "question";
  return "generic_task";
}

/**
 * Publish the latest generated site for a business. Flips GeneratedSite.status
 * from "draft" to "published" so the public /sites/[id] route will serve it.
 *
 * Routed through guardAction so that ApprovalPolicy.publish_artifacts gates
 * the side effect (Phase C). If approval is required and not yet granted,
 * a PendingAction is created and we return `needs_approval` — nothing flips.
 */
export async function publishSite(
  businessId: string,
  userId: string
): Promise<{ ok: boolean; message: string; url?: string; pendingActionId?: string }> {
  const { guardAction } = await import("@/lib/guard/guard");

  const result = await guardAction({
    businessId,
    userId,
    actionType: "publish_artifacts",
    riskLevel: "low",
    payload: { kind: "site_publish" },
    execute: async () => {
      const site = await db.generatedSite.findUnique({ where: { businessId } });
      if (!site) {
        return { kind: "no_site" } as const;
      }
      await db.generatedSite.update({
        where: { businessId },
        data: { status: "published" },
      });
      await db.activityEvent.create({
        data: {
          businessId,
          eventType: "site.published",
          level: "info",
          message: "Site published by owner",
          payload: JSON.stringify({ userId }),
        },
      });
      return { kind: "published" } as const;
    },
  });

  if (result.status === "needs_approval") {
    return {
      ok: false,
      message: "Site publish needs your approval. Check the approval queue.",
      pendingActionId: result.pendingActionId,
    };
  }
  if (result.status === "blocked") {
    return { ok: false, message: `Site publish blocked: ${result.reason}` };
  }
  if (result.status === "dry_run") {
    return { ok: true, message: "Dry run: would publish site." };
  }
  // executed
  const out = result.result as { kind: "no_site" | "published" } | undefined;
  if (out?.kind === "no_site") {
    return { ok: false, message: "No site to publish yet. Ask me to build it first." };
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    ok: true,
    message: "Site is live.",
    url: `${appUrl}/sites/${businessId}`,
  };
}

export async function handleOperatorMessage(params: {
  businessId: string;
  userId: string;
  text: string;
  conversationId?: string;
  channel?: string;
}): Promise<OperatorReply> {
  const { businessId, userId, text } = params;

  // 1. Ensure conversation + persist user message.
  const conversation = params.conversationId
    ? await db.conversation.findUnique({ where: { id: params.conversationId } })
    : await db.conversation.create({
        data: { businessId, channel: params.channel ?? "web" },
      });
  const convId = conversation?.id ?? (
    await db.conversation.create({
      data: { businessId, channel: params.channel ?? "web" },
    })
  ).id;

  await db.message.create({
    data: { conversationId: convId, role: "user", content: text },
  });

  // 2. Retrieve memory + RAG context + classify.
  const [memories, ragBlock] = await Promise.all([
    retrieveMemory({ businessId, query: text, userId, k: 6 }),
    buildRagContext({ businessId, query: text, userId, k: 6 }),
  ]);
  const intent = classifyIntent(text);

  let reply = "";
  let taskId: string | undefined;
  let featureRequestId: string | undefined;

  // 3. Dispatch.
  if (intent === "build_website") {
    // Phase T.2: when FEATURE_TEMPORAL is on, route the build through a
    // Temporal workflow (durable, retryable, observable). When off, use
    // the existing inline harness (fast path, no Temporal server needed).
    const { flags } = await import("@/lib/env");
    if (flags.temporal) {
      const { startBuildSiteWorkflow } = await import("@/lib/temporal/client");
      const handle = await startBuildSiteWorkflow({ businessId, userId });
      taskId = handle.taskId;
      reply = `Build started in Temporal (workflowId: ${handle.workflowId}). You'll see progress in the activity feed.`;
    } else {
      const out = await runTask({
        businessId,
        userId,
        title: "Build website",
        spec: { goal: `Build/refresh the marketing website. ${text}` },
        conversationId: convId,
      });
      taskId = out.taskId;
      reply = out.result.summary;
    }
  } else if (intent === "generic_task") {
    const matched = await matchSkill({ businessId, goal: text, userId });
    if (matched) {
      reply = `I found a proven playbook "${matched.name}" (confidence ${Math.round(matched.score * 100)}%). Running it now.`;
    }
    const out = await runTask({
      businessId,
      userId,
      title: matched?.name ?? text.slice(0, 60),
      spec: { goal: text },
      conversationId: convId,
    });
    taskId = out.taskId;
    reply = matched ? `${reply}\n\n${out.result.summary}` : out.result.summary;
  } else if (intent === "publish_site") {
    const out = await publishSite(businessId, userId);
    reply = out.ok
      ? `${out.message} ${out.url}`
      : out.message;
  } else if (intent === "run_ads") {
    const out = await planAdCampaign({ businessId, userId, brief: text });
    reply = out.ok
      ? `Ad campaign prepared${(out.launch as { status?: string })?.status === "needs_approval" ? " — awaiting your approval before spend." : "."}`
      : (out as { message?: string }).message ?? "Could not prepare ads.";
  } else if (intent === "create_receptionist") {
    const out = await setupReceptionist({ businessId, userId });
    reply =
      out.status === "ok"
        ? "Receptionist configured. Check the dashboard for status."
        : out.status === "needs_approval"
          ? "Receptionist setup is ready — please approve it in your dashboard."
          : "Could not set up receptionist yet.";
  } else if (intent === "competitor_intel") {
    const out = await refreshCompetitors(businessId, userId);
    reply = out.ok ? `Found ${out.found} nearby competitors. See your dashboard.` : "Competitor refresh failed.";
  } else if (intent === "outreach") {
    const fr = await db.featureRequest.create({
      data: {
        businessId,
        source: "owner",
        title: labelForIntent(intent),
        detail: text,
        status: "planned",
      },
    });
    featureRequestId = fr.id;
    reply = acknowledgementFor(intent);
  } else {
    reply = await answerQuestion(businessId, userId, text, memories, ragBlock);
  }

  // 4. Persist assistant message.
  await db.message.create({
    data: {
      conversationId: convId,
      role: "assistant",
      content: reply,
      taskId: taskId ?? null,
    },
  });

  // 5. Store a salient memory from the exchange (non-blocking).
  void addMemory({
    businessId,
    kind: "conversation",
    content: `Owner asked: "${text}". Operator: ${reply.slice(0, 240)}`,
    salience: intent === "question" ? 0.4 : 0.6,
    source: "operator_chat",
    userId,
  });

  return { conversationId: convId, reply, intent, taskId, featureRequestId };
}

async function answerQuestion(
  businessId: string,
  userId: string,
  text: string,
  memories: { kind: string; content: string; salience: number; id: string }[],
  ragBlock?: string
): Promise<string> {
  const llm = await resolveLlm(userId);
  const ctx = await loadBusinessContext(businessId);
  if (!llm || !ctx) {
    return "I can answer that once an LLM key is connected. Add one in Settings → API keys, and I'll have full context on your business.";
  }
  const memBlock = [ragBlock, memoryToPromptBlock(memories)].filter(Boolean).join("\n\n");
  try {
    const res = await complete(
      [
        {
          role: "system",
          content: `You are the always-on AI operator for ${ctx.name} (${ctx.type}). Be concise, concrete, and proactive. If an action would spend money or send messages, note that it needs the owner's approval.`,
        },
        {
          role: "user",
          content: `${memBlock ? memBlock + "\n\n" : ""}Business: ${ctx.name}. ${ctx.description ?? ""}\n\nQuestion: ${text}`,
        },
      ],
      { provider: llm.provider, apiKey: llm.apiKey, maxTokens: 800, temperature: 0.5 }
    );
    return res.content.trim() || "I'm not sure — could you rephrase?";
  } catch {
    return "I hit an error reaching the model. Try again in a moment.";
  }
}

function labelForIntent(intent: OperatorIntent): string {
  switch (intent) {
    case "run_ads":
      return "Run an ad campaign";
    case "create_receptionist":
      return "Set up AI receptionist";
    case "outreach":
      return "Outreach campaign";
    case "competitor_intel":
      return "Competitor intelligence";
    default:
      return "Initiative";
  }
}

function acknowledgementFor(intent: OperatorIntent): string {
  switch (intent) {
    case "run_ads":
      return "On it — I'll research your local market, draft ad creative, and prepare a campaign with a daily budget cap. I'll send it for your approval before any spend.";
    case "create_receptionist":
      return "Great — I'll configure an AI receptionist with your hours, offerings, and FAQs, then provision a phone number. I'll confirm before it goes live.";
    case "outreach":
      return "I'll draft the outreach and target the right contacts. Nothing sends until you approve it (we honor opt-outs and quiet hours).";
    case "competitor_intel":
      return "I'll scan nearby competitors and summarize how you compare. You'll see the findings in your dashboard shortly.";
    default:
      return "Queued. I'll keep you posted in your activity feed.";
  }
}
