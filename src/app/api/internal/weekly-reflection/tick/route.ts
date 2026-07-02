import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/env";
import { runWeeklyReflection } from "@/lib/learning/weekly";
import { db } from "@/lib/db";

/**
 * Phase I: weekly reflection cron.
 *
 * Iterates over all active businesses, runs the weekly reflection
 * (task scoring + skill promotion + dreaming cycle), and returns
 * a per-business summary. Protected by SCHEDULER_SECRET.
 */
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
    try {
      const r = await runWeeklyReflection(b.id, b.userId);
      results.push({ businessId: b.id, ...r });
    } catch (err) {
      results.push({
        businessId: b.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
