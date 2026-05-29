import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

type ApprovalDecision = "approve" | "reject";

export async function GET(
  _request: Request,
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

  const actions = await db.pendingAction.findMany({
    where: { businessId: id, status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ actions });
}

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
    select: { id: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    actionId?: string;
    decision?: ApprovalDecision;
    reason?: string;
  };

  if (!body.actionId || (body.decision !== "approve" && body.decision !== "reject")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const action = await db.pendingAction.findFirst({
    where: {
      id: body.actionId,
      businessId: id,
      status: "pending",
    },
  });

  if (!action) {
    return NextResponse.json({ error: "Pending action not found" }, { status: 404 });
  }

  const now = new Date();
  const approved = body.decision === "approve";

  await db.pendingAction.update({
    where: { id: action.id },
    data: {
      status: approved ? "approved" : "rejected",
      approverUserId: session.id,
      decisionReason: body.reason ?? null,
      approvedAt: approved ? now : null,
      rejectedAt: approved ? null : now,
    },
  });

  await db.activityEvent.create({
    data: {
      businessId: id,
      runId: action.runId,
      agent: "system",
      eventType: approved ? "approval.approved" : "approval.rejected",
      level: approved ? "info" : "warn",
      message: approved
        ? "Pending action approved by user"
        : "Pending action rejected by user",
      payload: JSON.stringify({
        actionId: action.id,
        actionType: action.actionType,
        reason: body.reason ?? null,
      }),
    },
  });

  if (action.actionType === "publish_artifacts" && approved) {
    await db.generatedSite.updateMany({
      where: { businessId: id },
      data: { status: "published" },
    });
    await db.marketingPlan.updateMany({
      where: { businessId: id },
      data: { status: "active" },
    });
    await db.business.update({
      where: { id },
      data: { status: "live" },
    });
  }

  if (action.actionType === "publish_artifacts" && !approved) {
    await db.business.update({
      where: { id },
      data: { status: "review" },
    });
  }

  return NextResponse.json({ ok: true, decision: body.decision });
}
