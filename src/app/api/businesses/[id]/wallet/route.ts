import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkCap } from "@/lib/usage/meter";

const topUpSchema = z.object({
  amountUsd: z.coerce.number().min(5).max(500),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({ where: { id, userId: session.id }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wallet = await db.creditWallet.findUnique({
    where: { businessId: id },
    include: { ledger: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  const llmCap = await checkCap({ businessId: id, kind: "llm_tokens", addAmount: 0, addCostUsd: 0 });
  const adCap = await checkCap({ businessId: id, kind: "ad_spend", addAmount: 0, addCostUsd: 0 });

  return NextResponse.json({
    wallet: wallet ?? { balanceUsd: 0, autoRecharge: false },
    usage: { llm: llmCap, ads: adCap },
    upgradeNudge: llmCap.hard || adCap.hard,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({ where: { id, userId: session.id }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = topUpSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const wallet = await db.creditWallet.upsert({
    where: { businessId: id },
    create: { businessId: id, balanceUsd: parsed.data.amountUsd },
    update: { balanceUsd: { increment: parsed.data.amountUsd } },
  });

  await db.creditLedger.create({
    data: {
      walletId: wallet.id,
      deltaUsd: parsed.data.amountUsd,
      reason: "manual_top_up",
      balanceAfterUsd: wallet.balanceUsd,
    },
  });

  return NextResponse.json({ ok: true, balanceUsd: wallet.balanceUsd });
}
