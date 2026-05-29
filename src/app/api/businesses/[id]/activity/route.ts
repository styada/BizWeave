import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const take = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, 100))
    : 20;

  const events = await db.activityEvent.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({ events });
}
