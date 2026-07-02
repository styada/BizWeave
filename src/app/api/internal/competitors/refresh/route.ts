import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshCompetitors } from "@/lib/competitors/refresh";

function isAuthorized(request: Request) {
  const secret = process.env.SCHEDULER_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;
  return request.headers.get("x-scheduler-secret") === secret;
}

/**
 * Daily competitor refresh across the fleet. Intended to be called by a cron
 * (Vercel Cron / external scheduler) with the scheduler secret. Only refreshes
 * businesses that have coordinates (i.e., have been geocoded).
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await db.business.findMany({
    where: { lat: { not: null }, lng: { not: null }, status: { not: "failed" } },
    select: { id: true, userId: true },
    take: 500,
  });

  let refreshed = 0;
  for (const b of businesses) {
    const r = await refreshCompetitors(b.id, b.userId);
    if (r.ok) refreshed += 1;
  }

  return NextResponse.json({ ok: true, total: businesses.length, refreshed });
}
