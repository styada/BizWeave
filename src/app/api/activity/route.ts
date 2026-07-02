import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  try {
    const where: Record<string, unknown> = {
      business: { userId: session.id },
    };
    if (businessId) {
      where.businessId = businessId;
    }

    const events = await db.activityEvent.findMany({
      where,
      include: {
        business: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        agent: e.agent,
        level: e.level,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
        businessName: e.business?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json({ events: [] });
  }
}
