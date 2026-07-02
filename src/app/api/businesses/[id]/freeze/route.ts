import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  action: z.enum(["freeze", "pause", "resume"]),
});

/**
 * Owner kill-switch / pause window. Freeze or pause halts all guarded
 * side-effects (guard.ts checks business.status); resume restores "active".
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({ where: { id, userId: session.id }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const status =
    parsed.data.action === "resume"
      ? "active"
      : parsed.data.action === "pause"
        ? "paused"
        : "frozen";

  await db.business.update({ where: { id }, data: { status } });
  await db.auditLog
    .create({
      data: {
        businessId: id,
        actorType: "user",
        actorId: session.id,
        action: `business.${parsed.data.action}`,
        riskLevel: "high",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, status });
}
