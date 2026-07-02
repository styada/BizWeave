import { z } from "zod";
import type { McpTool } from "@/lib/mcp/types";
import { db } from "@/lib/db";
import { optionalEnv } from "@/lib/env";

const provisionInput = z.object({
  greeting: z.string().min(1),
  knowledge: z.record(z.string(), z.unknown()),
});

/**
 * Provision (or update) a Vapi voice assistant for the business and persist a
 * PhoneAgent. Degrades to a draft PhoneAgent (no external call) when
 * VAPI_API_KEY is absent so the flow works in development.
 */
async function provisionAssistant(
  input: z.infer<typeof provisionInput>,
  businessId: string
) {
  const key = optionalEnv("VAPI_API_KEY");
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  if (!key) {
    const agent = await db.phoneAgent.upsert({
      where: await firstAgentId(businessId),
      create: {
        businessId,
        provider: "vapi",
        greeting: input.greeting,
        knowledge: input.knowledge as object,
        status: "draft",
      },
      update: { greeting: input.greeting, knowledge: input.knowledge as object },
    });
    return { phoneAgentId: agent.id, status: "draft" as const, dryRun: true };
  }

  try {
    const res = await fetch("https://api.vapi.ai/assistant", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${business?.name ?? "Business"} Receptionist`,
        firstMessage: input.greeting,
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are the friendly AI receptionist for ${business?.name ?? "the business"}. Use this knowledge to answer: ${JSON.stringify(input.knowledge)}. Be concise, warm, and helpful. Offer to take a message or book an appointment.`,
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Vapi ${res.status}`);
    const data = (await res.json()) as { id?: string };

    const agent = await db.phoneAgent.upsert({
      where: await firstAgentId(businessId),
      create: {
        businessId,
        provider: "vapi",
        providerId: data.id ?? null,
        greeting: input.greeting,
        knowledge: input.knowledge as object,
        status: "live",
      },
      update: {
        providerId: data.id ?? null,
        greeting: input.greeting,
        knowledge: input.knowledge as object,
        status: "live",
      },
    });
    return { phoneAgentId: agent.id, providerId: data.id, status: "live" as const };
  } catch (err) {
    return { status: "error" as const, error: err instanceof Error ? err.message : String(err) };
  }
}

// PhoneAgent has no unique(businessId); upsert on the existing id or a sentinel.
async function firstAgentId(businessId: string): Promise<{ id: string }> {
  const existing = await db.phoneAgent.findFirst({
    where: { businessId },
    select: { id: true },
  });
  return { id: existing?.id ?? "___none___" };
}

export const voiceTools: McpTool[] = [
  {
    name: "voice.provisionAssistant",
    description: "Create/update the AI receptionist (Vapi) with business knowledge.",
    sideEffect: true,
    riskLevel: "medium",
    actionType: "voice.provision",
    inputSchema: provisionInput,
    run: (input, ctx) =>
      provisionAssistant(input as z.infer<typeof provisionInput>, ctx.businessId),
  },
];

export { provisionAssistant };
