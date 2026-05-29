import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueBusinessRun, processExecutionById } from "@/lib/scheduler";

export async function POST(
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
  });
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const execution = await enqueueBusinessRun({
      businessId: id,
      source: "manual",
      agent: "orchestrator",
    });

    const url = new URL(request.url);
    const processNow = url.searchParams.get("processNow") !== "false";

    if (!processNow) {
      return NextResponse.json({
        queued: true,
        executionId: execution.id,
      });
    }

    const queueResult = await processExecutionById(execution.id);
    return NextResponse.json({
      queued: true,
      executionId: execution.id,
      queueResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue run";
    console.error("Run queue error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
