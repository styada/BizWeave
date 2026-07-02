import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/env";
import { runMaintenanceCheck } from "@/lib/maintenance/check";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const secret = optionalEnv("SCHEDULER_SECRET");
  if (secret && request.headers.get("x-scheduler-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await db.business.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true },
    take: 100,
  });

  const results = [];
  for (const b of businesses) {
    const issues = await runMaintenanceCheck(b.id);
    results.push({ businessId: b.id, issues: issues.length });
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
