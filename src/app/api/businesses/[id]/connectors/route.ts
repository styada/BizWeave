import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { listConnectors, checkConnectorHealth } from "@/lib/connectors/registry";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({ where: { id, userId: session.id }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [marketplace, health] = await Promise.all([
    Promise.resolve(listConnectors()),
    checkConnectorHealth(id),
  ]);
  return NextResponse.json({ marketplace, connected: health });
}
