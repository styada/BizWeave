import { optionalEnv, hasStripeKey } from "@/lib/env";
import { db } from "@/lib/db";

const API = "https://api.stripe.com/v1";

/**
 * Agentic procurement via Stripe Issuing (one-time virtual cards). Degrades to
 * a pending Purchase record when Issuing is not configured.
 */
export async function createVirtualPurchase(params: {
  businessId: string;
  vendor: string;
  amountUsd: number;
  description: string;
  approvalId?: string;
}): Promise<{ ok: boolean; purchaseId: string; cardLast4?: string; dryRun?: boolean }> {
  const purchase = await db.purchase.create({
    data: {
      businessId: params.businessId,
      vendor: params.vendor,
      description: params.description,
      amountUsd: params.amountUsd,
      status: "pending",
      method: "stripe_issuing_spt",
      approvalId: params.approvalId ?? null,
    },
  });

  const key = optionalEnv("STRIPE_SECRET_KEY");
  const cardholder = optionalEnv("STRIPE_ISSUING_CARDHOLDER_ID");
  if (!hasStripeKey() || !cardholder || optionalEnv("STRIPE_ISSUING_ENABLED") !== "true") {
    await db.purchase.update({
      where: { id: purchase.id },
      data: { status: "approved" },
    });
    return { ok: true, purchaseId: purchase.id, dryRun: true };
  }

  try {
    const res = await fetch(`${API}/issuing/cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        cardholder,
        currency: "usd",
        type: "virtual",
        "spending_controls[spending_limits][0][amount]": String(Math.ceil(params.amountUsd * 100)),
        "spending_controls[spending_limits][0][interval]": "per_authorization",
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as { id?: string; last4?: string };
    if (!res.ok) throw new Error(JSON.stringify(data));

    await db.purchase.update({
      where: { id: purchase.id },
      data: { status: "completed", completedAt: new Date() },
    });
    return { ok: true, purchaseId: purchase.id, cardLast4: data.last4 };
  } catch {
    await db.purchase.update({ where: { id: purchase.id }, data: { status: "failed" } });
    return { ok: false, purchaseId: purchase.id };
  }
}
