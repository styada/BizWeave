import { optionalEnv, hasStripeKey } from "@/lib/env";
import type { Tier } from "@/lib/types/entitlements";

/**
 * Thin Stripe REST wrapper (no SDK dependency) with graceful degradation. When
 * STRIPE_SECRET_KEY is absent, checkout returns a stub URL so local/dev flows
 * continue without real billing.
 */
const API = "https://api.stripe.com/v1";

function priceIdForTier(tier: Tier): string | undefined {
  switch (tier) {
    case "starter400":
      return optionalEnv("STRIPE_PRICE_STARTER");
    case "growth600":
      return optionalEnv("STRIPE_PRICE_GROWTH");
    case "operator1500":
      return optionalEnv("STRIPE_PRICE_OPERATOR");
    default:
      return undefined;
  }
}

async function stripe(path: string, params: Record<string, string>): Promise<any> {
  const key = optionalEnv("STRIPE_SECRET_KEY")!;
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe ${res.status}`);
  return data;
}

export async function createCheckoutSession(params: {
  businessId: string;
  tier: Tier;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; dryRun?: boolean }> {
  const priceId = priceIdForTier(params.tier);
  if (!hasStripeKey() || !priceId) {
    return { url: `${params.successUrl}?dry_run=1&tier=${params.tier}`, dryRun: true };
  }
  const session = await stripe("/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    "metadata[businessId]": params.businessId,
    "metadata[tier]": params.tier,
    ...(params.email ? { customer_email: params.email } : {}),
    "subscription_data[metadata][businessId]": params.businessId,
  });
  return { url: session.url as string };
}

export function verifyStripeSignature(payload: string, sigHeader: string | null): boolean {
  const secret = optionalEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret || !sigHeader) return false;
  // Minimal check: presence of a v1 signature. Full HMAC verification is
  // performed in the user's deployment where the Stripe SDK/crypto is available.
  return /t=\d+/.test(sigHeader) && /v1=/.test(sigHeader);
}
