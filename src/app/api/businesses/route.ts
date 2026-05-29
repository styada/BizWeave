import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { businessSchema } from "@/lib/validations";
import { bootstrapBusinessAutomation } from "@/lib/scheduler";

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

    await bootstrapBusinessAutomation(business.id);

    return NextResponse.json({ business });
  } catch (error) {
    console.error("Create business error:", error);
    return NextResponse.json({ error: "Failed to create business" }, { status: 500 });
  }
}
