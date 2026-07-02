import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/env";
import { promoteSkillsToLibrary } from "@/lib/learning/promote";

/** Nightly skill-promotion cron (dogfood loop). Protected by scheduler secret. */
export async function POST(request: Request) {
  const secret = optionalEnv("SCHEDULER_SECRET");
  if (secret && request.headers.get("x-scheduler-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await promoteSkillsToLibrary({ autoApprove: false });
  return NextResponse.json({ ok: true, ...result });
}
