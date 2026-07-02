import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { refreshCompetitors } from "@/lib/competitors/refresh";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const competitors = await db.competitor.findMany({
    where: { businessId: id },
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
    take: 100,
  });
  return NextResponse.json({ competitors });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await refreshCompetitors(id, session.id);
  return NextResponse.json(result);
}
