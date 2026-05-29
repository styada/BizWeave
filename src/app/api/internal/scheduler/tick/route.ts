import { NextResponse } from "next/server";
import { processQueuedExecutions, queueDueScheduledTasks } from "@/lib/scheduler";

function isAuthorized(request: Request) {
  const secret = process.env.SCHEDULER_SECRET;

  if (!secret && process.env.NODE_ENV !== "production") {
    return true;
  }

  if (!secret) {
    return false;
  }

  return request.headers.get("x-scheduler-secret") === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queued = await queueDueScheduledTasks();
  const processed = await processQueuedExecutions(10);

  return NextResponse.json({
    ok: true,
    queued,
    processed,
    now: new Date().toISOString(),
  });
}
