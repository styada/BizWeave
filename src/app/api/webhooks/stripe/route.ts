import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStripeSignature } from "@/lib/billing/stripe";
import { entitlementsForTier } from "@/lib/billing/entitlements";
import type { Tier } from "@/lib/types/entitlements";

/**
 * Stripe webhook: keeps Subscription tier/status in sync with billing events.
 * Signature is verified when STRIPE_WEBHOOK_SECRET is configured.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (process.env.STRIPE_WEBHOOK_SECRET && !verifyStripeSignature(raw, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: any } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const obj = event.data?.object ?? {};
  const businessId: string | undefined = obj?.metadata?.businessId;

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        if (!businessId) break;
        const tier = (obj?.metadata?.tier as Tier) ?? "starter400";
        const status = obj?.status === "active" || event.type === "checkout.session.completed"
          ? "active"
          : (obj?.status ?? "active");
        await db.subscription.upsert({
          where: { businessId },
          create: {
            businessId,
            tier,
            status,
            entitlements: entitlementsForTier(tier) as object,
            stripeCustomerId: obj?.customer ?? null,
            stripeSubscriptionId: obj?.subscription ?? obj?.id ?? null,
          },
          update: {
            tier,
            status,
            entitlements: entitlementsForTier(tier) as object,
            stripeCustomerId: obj?.customer ?? undefined,
            stripeSubscriptionId: obj?.subscription ?? obj?.id ?? undefined,
          },
        });
        break;
      }
      case "customer.subscription.deleted": {
        if (!businessId) break;
        await db.subscription.updateMany({
          where: { businessId },
          data: { tier: "free", status: "canceled", entitlements: entitlementsForTier("free") as object },
        });
        break;
      }
      case "invoice.payment_failed": {
        if (!businessId) break;
        await db.subscription.updateMany({ where: { businessId }, data: { status: "past_due" } });
        break;
      }
      default:
        break;
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ received: true });
}
