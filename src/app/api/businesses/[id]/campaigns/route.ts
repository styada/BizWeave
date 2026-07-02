import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const campaignSchema = z.object({
  channel: z.enum(["email", "sms", "whatsapp", "social"]),
  name: z.string().min(1).max(200),
  subject: z.string().max(300).optional(),
  body: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
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

  const campaigns = await db.campaign.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sends: true } } },
  });
  return NextResponse.json({ campaigns });
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

  try {
    const parsed = campaignSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const c = parsed.data;
    const campaign = await db.campaign.create({
      data: {
        businessId: id,
        channel: c.channel,
        name: c.name,
        subject: c.subject ?? null,
        body: c.body,
        status: c.scheduledAt ? "scheduled" : "draft",
        scheduledAt: c.scheduledAt ? new Date(c.scheduledAt) : null,
      },
    });
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Campaign error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
