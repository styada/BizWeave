import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { businessSchema } from "@/lib/validations";
import { bootstrapBusinessAutomation } from "@/lib/scheduler";
import { addMemory } from "@/lib/memory/store";

/**
 * Phase E: seed initial memory rows from onboarding form fields so the agent
 * can answer questions like "what are your hours?" on day 1. Each non-empty
 * field becomes one MemoryEntry. Embeddings are written async (best-effort).
 */
async function seedBusinessMemory(
  businessId: string,
  data: {
    name: string;
    type: string;
    tagline?: string | null;
    description?: string | null;
    location?: string | null;
    phone?: string | null;
    email?: string | null;
  },
  userId: string
): Promise<void> {
  const facts: { kind: "fact" | "preference"; content: string }[] = [
    { kind: "fact", content: `Business name: ${data.name}` },
    { kind: "fact", content: `Business type: ${data.type}` },
  ];
  if (data.tagline) facts.push({ kind: "fact", content: `Tagline: ${data.tagline}` });
  if (data.description)
    facts.push({ kind: "fact", content: `Description: ${data.description}` });
  if (data.location) facts.push({ kind: "fact", content: `Location: ${data.location}` });
  if (data.phone) facts.push({ kind: "preference", content: `Phone: ${data.phone}` });
  if (data.email) facts.push({ kind: "preference", content: `Email: ${data.email}` });

  for (const f of facts) {
    await addMemory({
      businessId,
      kind: f.kind,
      content: f.content,
      salience: 0.8,
      source: "onboarding",
      userId,
    });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await db.business.findMany({
    where: { userId: session.id },
    include: {
      site: { select: { status: true } },
      _count: { select: { inventory: true, agentRuns: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ businesses });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = businessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const business = await db.business.create({
      data: {
        userId: session.id,
        name: data.name,
        type: data.type,
        tagline: data.tagline,
        description: data.description,
        location: data.location,
        phone: data.phone,
        email: data.email || null,
        status: "draft",
      },
    });

    // Phase E: seed initial memory rows from the onboarding form so the agent
    // can answer questions about the business from day 1. Best-effort.
    await seedBusinessMemory(business.id, data, session.id).catch(() => undefined);

    await bootstrapBusinessAutomation(business.id);

    return NextResponse.json({ business });
  } catch (error) {
    console.error("Create business error:", error);
    return NextResponse.json({ error: "Failed to create business" }, { status: 500 });
  }
}
