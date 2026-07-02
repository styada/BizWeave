import { db } from "@/lib/db";
import type { Entitlements } from "@/lib/types/entitlements";
import { entitlementsForTier, entitlementKeyForUsage } from "@/lib/billing/entitlements";
import type { Tier } from "@/lib/types/entitlements";

export type UsageKind =
  | "llm_tokens"
  | "sandbox_sec"
  | "email"
  | "sms"
  | "voice_min"
  | "ad_spend"
  | "task";

export class CapExceededError extends Error {
  constructor(
    public readonly kind: UsageKind,
    public readonly ratio: number
  ) {
    super(`CAP_EXCEEDED: ${kind} (${Math.round(ratio * 100)}% of allowance)`);
    this.name = "CapExceededError";
  }
}

/** Records a usage event. Best-effort — never throws into the caller. */
export async function recordUsage(params: {
  businessId: string;
  kind: UsageKind;
  quantity: number;
  costUsd?: number;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.usageEvent.create({
      data: {
        businessId: params.businessId,
        kind: params.kind,
        quantity: params.quantity,
        costUsd: params.costUsd ?? 0,
        meta: params.meta ?? undefined,
      },
    });
  } catch (err) {
    console.error("[meter] recordUsage failed:", err);
  }
}

function periodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function subscriptionEntitlements(
  businessId: string
): Promise<Entitlements> {
  const sub = await db.subscription.findUnique({ where: { businessId } });
  if (!sub) return entitlementsForTier("free");
  const raw = sub.entitlements as unknown as Entitlements | null;
  if (raw && typeof raw === "object" && "tier" in raw) return raw;
  return entitlementsForTier((sub.tier as Tier) ?? "free");
}

/** Converts an entitlement allowance into the same unit the usage is metered in. */
function allowanceFor(kind: UsageKind, ent: Entitlements): number | null {
  const key = entitlementKeyForUsage(kind);
  if (!key) return null;
  const value = ent[key];
  if (typeof value !== "number") return null;
  // sandbox usage is metered in seconds; entitlement is in hours.
  if (kind === "sandbox_sec") return value * 3600;
  return value;
}

/** Current-period consumed amount, in the unit the usage is metered in. */
async function consumed(businessId: string, kind: UsageKind): Promise<number> {
  const rows = await db.usageEvent.findMany({
    where: { businessId, kind, occurredAt: { gte: periodStart() } },
    select: { quantity: true, costUsd: true },
  });
  // llm/ad are limited by USD cost; everything else by quantity.
  const byCost = kind === "llm_tokens" || kind === "ad_spend";
  return rows.reduce((sum, r) => sum + (byCost ? r.costUsd : r.quantity), 0);
}

export type CapCheck = {
  allowed: boolean;
  ratio: number; // 0..>1 of allowance consumed after adding
  soft: boolean; // >= 80%
  hard: boolean; // >= 100%
  paidFromWallet: boolean;
};

/**
 * Checks whether `addAmount` more of `kind` is permitted this period.
 * Over 100%: attempt to cover the overage from the PAYG CreditWallet;
 * if the wallet can't cover it, the action is disallowed (circuit breaker).
 */
export async function checkCap(params: {
  businessId: string;
  kind: UsageKind;
  addAmount: number;
  addCostUsd?: number;
}): Promise<CapCheck> {
  const ent = await subscriptionEntitlements(params.businessId);
  const allowance = allowanceFor(params.kind, ent);

  // No allowance defined for this kind -> not metered here.
  if (allowance === null) {
    return { allowed: true, ratio: 0, soft: false, hard: false, paidFromWallet: false };
  }

  const byCost = params.kind === "llm_tokens" || params.kind === "ad_spend";
  const add = byCost ? params.addCostUsd ?? 0 : params.addAmount;
  const used = await consumed(params.businessId, params.kind);
  const projected = used + add;
  const ratio = allowance === 0 ? (projected > 0 ? Infinity : 0) : projected / allowance;

  if (projected <= allowance) {
    return { allowed: true, ratio, soft: ratio >= 0.8, hard: false, paidFromWallet: false };
  }

  // Over allowance -> try PAYG wallet for the USD overage.
  const overageUsd = byCost ? projected - allowance : params.addCostUsd ?? 0;
  const wallet = await db.creditWallet.findUnique({
    where: { businessId: params.businessId },
  });
  if (wallet && wallet.balanceUsd >= overageUsd && overageUsd > 0) {
    return { allowed: true, ratio, soft: true, hard: true, paidFromWallet: true };
  }

  return { allowed: false, ratio, soft: true, hard: true, paidFromWallet: false };
}

/** Debit the PAYG wallet and append a ledger entry. */
export async function debitWallet(
  businessId: string,
  amountUsd: number,
  reason: string
): Promise<void> {
  if (amountUsd <= 0) return;
  const wallet = await db.creditWallet.findUnique({ where: { businessId } });
  if (!wallet) return;
  const balanceAfter = wallet.balanceUsd - amountUsd;
  await db.$transaction([
    db.creditWallet.update({
      where: { businessId },
      data: { balanceUsd: balanceAfter },
    }),
    db.creditLedger.create({
      data: {
        walletId: wallet.id,
        deltaUsd: -amountUsd,
        reason,
        balanceAfterUsd: balanceAfter,
      },
    }),
  ]);
}
