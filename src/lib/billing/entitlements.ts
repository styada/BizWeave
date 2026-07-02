import type { Entitlements, Tier } from "@/lib/types/entitlements";

/** Monthly list price per tier (USD). */
export const TIER_PRICE_USD: Record<Tier, number> = {
  free: 0,
  starter400: 400,
  growth600: 600,
  operator1500: 1500,
};

export const TIER_LABEL: Record<Tier, string> = {
  free: "Listing (Free)",
  starter400: "Presence",
  growth600: "Growth",
  operator1500: "Full Operator",
};

/** Included entitlements per tier (Section 23 / Appendix C). */
export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  free: {
    tier: "free",
    agentTaskMinutes: 0,
    llmCreditsUsd: 0,
    sandboxHours: 0,
    emails: 0,
    sms: 0,
    voiceMinutes: 0,
    managedAdSpendUsd: 0,
    sites: 1,
    domains: 0,
    connectors: 0,
    seats: 1,
  },
  starter400: {
    tier: "starter400",
    agentTaskMinutes: 300,
    llmCreditsUsd: 15,
    sandboxHours: 5,
    emails: 2000,
    sms: 0,
    voiceMinutes: 0,
    managedAdSpendUsd: 0,
    sites: 1,
    domains: 1,
    connectors: 3,
    seats: 2,
  },
  growth600: {
    tier: "growth600",
    agentTaskMinutes: 900,
    llmCreditsUsd: 45,
    sandboxHours: 15,
    emails: 10000,
    sms: 1000,
    voiceMinutes: 0,
    managedAdSpendUsd: 1000,
    sites: 2,
    domains: 2,
    connectors: 6,
    seats: 3,
  },
  operator1500: {
    tier: "operator1500",
    agentTaskMinutes: 3000,
    llmCreditsUsd: 110,
    sandboxHours: 40,
    emails: 30000,
    sms: 5000,
    voiceMinutes: 400,
    managedAdSpendUsd: 10000,
    sites: 5,
    domains: 5,
    connectors: 20,
    seats: 10,
  },
};

export function entitlementsForTier(tier: Tier): Entitlements {
  return ENTITLEMENTS[tier] ?? ENTITLEMENTS.free;
}

/**
 * Multi-business pricing: $250/mo off each additional business, floored at
 * $1,000/mo per business (Section 8/15). `index` is 0-based across the
 * workspace's businesses ordered by creation.
 */
export function priceForBusinessAt(tier: Tier, index: number): number {
  const list = TIER_PRICE_USD[tier];
  if (index <= 0) return list;
  const discounted = list - 250 * index;
  return Math.max(discounted, Math.min(list, 1000));
}

/** Map a UsageEvent kind to the entitlement field that limits it. */
export function entitlementKeyForUsage(
  kind: string
): keyof Entitlements | null {
  switch (kind) {
    case "llm_tokens":
      return "llmCreditsUsd";
    case "sandbox_sec":
      return "sandboxHours";
    case "email":
      return "emails";
    case "sms":
      return "sms";
    case "voice_min":
      return "voiceMinutes";
    case "ad_spend":
      return "managedAdSpendUsd";
    default:
      return null;
  }
}
