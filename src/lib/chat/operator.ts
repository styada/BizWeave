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
  const t = text.toLowerCase();
  if (/(build|make|create|redo|update).*(web ?site|landing|page|site)/.test(t))
    return "build_website";
  if (/\b(ad|ads|advertis|campaign|boost|promote)\b/.test(t)) return "run_ads";
  if (/(receptionist|answer.*(call|phone)|phone agent|voice)/.test(t))
    return "create_receptionist";
  if (/(email|newsletter|sms|text|outreach|loyalty|members?hip|social post)/.test(t))
    return "outreach";
  if (/(competitor|competition|nearby|market research|who else)/.test(t))
    return "competitor_intel";
  if (/^(what|who|when|where|why|how|is|are|do|does|can|should|tell me)/.test(t.trim()))
    return "question";
  return "generic_task";
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
    const out = await runTask({
      businessId,
      userId,
      title: "Build website",
      spec: { goal: `Build/refresh the marketing website. ${text}` },
      conversationId: convId,
    });
    taskId = out.taskId;
    reply = out.result.summary;
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
