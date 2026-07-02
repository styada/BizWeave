import { db } from "@/lib/db";
import { ensureMcpBootstrapped } from "@/lib/mcp";

/**
 * Configure the AI receptionist: assemble the business knowledge (hours,
 * offerings, contact, FAQs) and provision the assistant through the guarded
 * voice MCP tool. Returns the guarded result (may be needs_approval).
 */
export async function setupReceptionist(params: {
  businessId: string;
  userId: string;
  greeting?: string;
}) {
  const business = await db.business.findUnique({
    where: { id: params.businessId },
    include: { inventory: { take: 30 } },
  });
  if (!business) return { status: "error" as const, error: "not_found" };

  const knowledge = {
    name: business.name,
    type: business.type,
    description: business.description,
    hours: business.hours ?? "Call for hours",
    address: business.location,
    phone: business.phone,
    email: business.email,
    offerings: business.inventory.map((i) => ({ name: i.name, price: i.price })),
    faqs: [
      { q: "What are your hours?", a: "See our posted hours; ask me for today's." },
      { q: "Where are you located?", a: business.location ?? "Ask for directions." },
    ],
  };

  const greeting =
    params.greeting ??
    `Thanks for calling ${business.name}! I'm the AI assistant — how can I help you today?`;

  const mcp = ensureMcpBootstrapped();
  return mcp.invoke("voice.provisionAssistant", { greeting, knowledge }, {
    businessId: params.businessId,
    userId: params.userId,
    dryRun: false,
  });
}
