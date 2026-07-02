import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { planAdCampaign, computeRoas } from "@/lib/ads/engine";
import { z } from "zod";

const planSchema = z.object({
  brief: z.string().min(3).max(500),
  platform: z.enum(["meta", "google"]).optional(),
  dailyBudgetUsd: z.coerce.number().min(1).max(10000).optional(),
  durationDays: z.coerce.number().min(1).max(90).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({ where: { id, userId: session.id }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaigns = await db.adCampaign.findMany({
    where: { businessId: id },
    include: { creatives: true },
    orderBy: { createdAt: "desc" },
  });
  const roas = await computeRoas(id);
  return NextResponse.json({ campaigns, roas });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({ where: { id, userId: session.id }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const result = await planAdCampaign({ businessId: id, userId: session.id, ...parsed.data });
  return NextResponse.json(result);
}
