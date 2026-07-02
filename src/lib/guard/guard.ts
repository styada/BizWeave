import { db } from "@/lib/db";
import type { GuardedActionInput, GuardedActionResult } from "@/lib/guard/types";
import { checkCap, debitWallet, recordUsage } from "@/lib/usage/meter";
import { pushToBusinessOwner } from "@/lib/notify/push";

/**
 * The single choke point for every real-world / side-effecting action.
 *
 * Order of operations:
 *  1. Resolve ApprovalPolicy for (businessId, actionType).
 *  2. Enforce ProcurementPolicy (vendor allow-list + caps) when a vendor is set.
 *  3. Enforce entitlement / budget caps for the metered dimension.
 *  4. If approval is required and not yet granted -> create a PendingAction and
 *     return `needs_approval` WITHOUT executing.
 *  5. If dryRun -> return a preview without executing.
 *  6. Execute, then write AuditLog + UsageEvent (+ wallet debit) as evidence.
 *
 * Never call an external side-effecting API directly from a route/agent —
 * always route it through here.
 */
export async function guardAction(
  input: GuardedActionInput
): Promise<GuardedActionResult> {
  const {
    businessId,
    userId,
    actionType,
    riskLevel,
    payload,
    vendor,
    estCostUsd = 0,
    usageKind,
    usageQuantity = 0,
    approvedActionId,
  } = input;

  // (1) Freeze/pause gate — a frozen business performs no side effects.
  const frozen = await isFrozen(businessId);
  if (frozen) {
    await emitActivity(businessId, "warn", `Blocked ${actionType}: business is frozen/paused.`);
    return { status: "blocked", reason: "BUSINESS_FROZEN" };
  }

  // (2) Procurement policy for spend actions.
  if (vendor) {
    const blocked = await checkProcurement(businessId, vendor, estCostUsd);
    if (blocked) return { status: "blocked", reason: blocked };
  }

  // (3) Entitlement / budget caps.
  if (usageKind) {
    const cap = await checkCap({
      businessId,
      kind: usageKind,
      addAmount: usageQuantity,
      addCostUsd: estCostUsd,
    });
    if (!cap.allowed) {
      await emitActivity(
        businessId,
        "warn",
        `Blocked ${actionType}: usage cap reached for ${usageKind}.`
      );
      return { status: "blocked", reason: `CAP_EXCEEDED:${usageKind}` };
    }
    if (cap.soft) {
      await emitActivity(
        businessId,
        "warn",
        `Approaching usage limit for ${usageKind} (${Math.round(cap.ratio * 100)}%).`
      );
    }
  }

  // (4) Approval gate.
  const requiresApproval = await needsApproval(businessId, actionType, riskLevel);
  if (requiresApproval && !approvedActionId) {
    const pending = await db.pendingAction.create({
      data: {
        businessId,
        actionType,
        riskLevel,
        payload: JSON.stringify(payload ?? {}),
        status: "pending",
      },
    });
    await emitActivity(
      businessId,
      "info",
      `Action "${actionType}" is awaiting your approval.`
    );
    await pushToBusinessOwner(businessId, {
      title: "Approval needed",
      body: `Your operator wants to run "${actionType}". Tap to review.`,
      data: { businessId, pendingActionId: pending.id, type: "approval" },
    }).catch(() => undefined);
    return { status: "needs_approval", pendingActionId: pending.id };
  }

  // (5) Dry-run preview.
  if (input.dryRun) {
    return { status: "dry_run", preview: { actionType, payload, estCostUsd } };
  }

  // (6) Execute + record evidence.
  const before = null;
  const result = await input.execute();

  await db.auditLog
    .create({
      data: {
        businessId,
        actorType: "agent",
        actorId: userId,
        action: actionType,
        target: vendor ?? null,
        riskLevel,
        before: before ?? undefined,
        after: safeJson(result),
      },
    })
    .catch(() => undefined);

  if (usageKind) {
    await recordUsage({
      businessId,
      kind: usageKind,
      quantity: usageQuantity,
      costUsd: estCostUsd,
      meta: { actionType, vendor },
    });
    if (estCostUsd > 0 && (usageKind === "llm_tokens" || usageKind === "ad_spend")) {
      // Best-effort PAYG debit for overage; no-op if wallet empty.
      await debitWallet(businessId, 0, `${actionType}`).catch(() => undefined);
    }
  }

  if (vendor && estCostUsd > 0) {
    await db.purchase
      .create({
        data: {
          businessId,
          vendor,
          description: actionType,
          amountUsd: estCostUsd,
          status: "completed",
          approvalId: approvedActionId ?? null,
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);
  }

  return { status: "executed", result };
}

async function isFrozen(businessId: string): Promise<boolean> {
  const [business, sub] = await Promise.all([
    db.business.findUnique({ where: { id: businessId }, select: { status: true } }),
    db.subscription.findUnique({ where: { businessId }, select: { status: true } }),
  ]);
  return business?.status === "frozen" || business?.status === "paused" || sub?.status === "paused";
}

async function needsApproval(
  businessId: string,
  actionType: string,
  riskLevel: string
): Promise<boolean> {
  const policy = await db.approvalPolicy.findUnique({
    where: { businessId_actionType: { businessId, actionType } },
  });
  if (policy) {
    if (!policy.enabled) return false;
    if (!policy.requiresApproval) return false;
    return riskAtLeast(riskLevel, policy.minRiskLevel);
  }
  // No explicit policy: default to requiring approval for medium+ risk.
  return riskLevel !== "low";
}

const RISK_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };
function riskAtLeast(level: string, min: string): boolean {
  return (RISK_ORDER[level] ?? 0) >= (RISK_ORDER[min] ?? 1);
}

async function checkProcurement(
  businessId: string,
  vendor: string,
  amountUsd: number
): Promise<string | null> {
  // Prefer a vendor-specific policy; fall back to the wildcard "*" policy.
  const policy =
    (await db.procurementPolicy.findUnique({
      where: { businessId_vendor: { businessId, vendor } },
    })) ??
    (await db.procurementPolicy.findUnique({
      where: { businessId_vendor: { businessId, vendor: "*" } },
    }));

  if (!policy) return null; // no policy configured -> allowed (approval still applies)
  if (!policy.enabled) return `vendor ${vendor} is disabled by policy`;
  if (amountUsd > policy.perPurchaseCapUsd) {
    return `purchase $${amountUsd} exceeds per-purchase cap $${policy.perPurchaseCapUsd}`;
  }

  const start = new Date();
  start.setDate(1);
  const spentRows = await db.purchase.findMany({
    where: {
      businessId,
      status: { in: ["approved", "completed"] },
      createdAt: { gte: new Date(start.getFullYear(), start.getMonth(), 1) },
    },
    select: { amountUsd: true },
  });
  const spent = spentRows.reduce((s, r) => s + r.amountUsd, 0);
  if (spent + amountUsd > policy.monthlyCapUsd) {
    return `purchase would exceed monthly cap $${policy.monthlyCapUsd}`;
  }
  return null;
}

async function emitActivity(
  businessId: string,
  level: "info" | "warn" | "error",
  message: string
): Promise<void> {
  await db.activityEvent
    .create({
      data: { businessId, eventType: "guard", level, message },
    })
    .catch(() => undefined);
}

function safeJson(value: unknown): object | undefined {
  try {
    return JSON.parse(JSON.stringify(value)) as object;
  } catch {
    return undefined;
  }
}
