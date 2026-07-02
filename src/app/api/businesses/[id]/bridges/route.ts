import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  provider: z.enum(["whatsapp", "telegram", "sms"]),
  externalId: z.string().min(1).max(64),
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

  const bridges = await db.messagingBridge.findMany({ where: { businessId: id } });
  return NextResponse.json({ bridges });
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

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const bridge = await db.messagingBridge.upsert({
    where: {
      provider_externalId: { provider: parsed.data.provider, externalId: parsed.data.externalId },
    },
    create: { businessId: id, provider: parsed.data.provider, externalId: parsed.data.externalId },
    update: { businessId: id },
  });
  return NextResponse.json({ bridge });
}
