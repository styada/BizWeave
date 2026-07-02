import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { runTask } from "@/lib/executor/router";
import { z } from "zod";

const createTaskSchema = z.object({
  goal: z.string().min(3).max(2000),
  title: z.string().max(200).optional(),
  budgetUsd: z.coerce.number().min(0).max(100).optional(),
  dryRun: z.boolean().optional(),
});

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

  const tasks = await db.agentTask.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ tasks });
}

export async function POST(
  request: Request,
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

  try {
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { goal, title, budgetUsd, dryRun } = parsed.data;

    const { taskId, result } = await runTask({
      businessId: id,
      userId: session.id,
      title: title ?? goal.slice(0, 80),
      spec: { goal, budgetUsd, dryRun },
    });

    return NextResponse.json({ taskId, result });
  } catch (error) {
    console.error("Task error:", error);
    return NextResponse.json({ error: "Failed to run task" }, { status: 500 });
  }
}
