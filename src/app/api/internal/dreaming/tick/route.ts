import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/env";
import { runDreamingCycle } from "@/lib/dreaming/cycle";
import { db } from "@/lib/db";

/** Nightly dreaming cron for all active businesses. */
export async function POST(request: Request) {
  const secret = optionalEnv("SCHEDULER_SECRET");
  if (secret && request.headers.get("x-scheduler-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await db.business.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, userId: true },
    take: 100,
  });

  const results = [];
  for (const b of businesses) {
    const r = await runDreamingCycle(b.id, b.userId);
    results.push({ businessId: b.id, mood: r.mood, proposals: r.proposals.length });
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
