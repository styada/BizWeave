import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { setupReceptionist } from "@/lib/voice/receptionist";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({ where: { id, userId: session.id }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agent = await db.phoneAgent.findFirst({ where: { businessId: id } });
  const calls = await db.callLog.findMany({
    where: { businessId: id },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ agent, calls });
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

  const body = (await request.json().catch(() => ({}))) as { greeting?: string };
  const result = await setupReceptionist({ businessId: id, userId: session.id, greeting: body.greeting });
  return NextResponse.json(result);
}
