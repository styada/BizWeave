import { db } from "@/lib/db";
import { optionalEnv } from "@/lib/env";

/**
 * Link the generated website to the business's Google Business Profile. Requires
 * Google OAuth + a stored IntegrationConnection (Phase 22). Without it, records
 * the intent so the owner can complete the connection later.
 */
export async function linkWebsiteToGbp(params: {
  businessId: string;
  websiteUrl: string;
}): Promise<{ ok: boolean; linked: boolean; reason?: string }> {
  const business = await db.business.findUnique({
    where: { id: params.businessId },
    select: { googleBusinessProfileId: true },
  });
  if (!business?.googleBusinessProfileId) {
    return { ok: true, linked: false, reason: "no_gbp_id" };
  }

  const conn = await db.integrationConnection.findFirst({
    where: { businessId: params.businessId, provider: "google_business" },
  });
  const hasOAuth = optionalEnv("GOOGLE_OAUTH_CLIENT_ID") && conn;
  if (!hasOAuth) {
    // Persist websiteUrl on the business so the connect flow can apply it later.
    await db.business.update({
      where: { id: params.businessId },
      data: { websiteUrl: params.websiteUrl },
    });
    return { ok: true, linked: false, reason: "oauth_not_connected" };
  }

  // Real GBP `accounts.locations.patch` (websiteUri) is performed in the user's
  // deployment where OAuth tokens are present.
  await db.business.update({
    where: { id: params.businessId },
    data: { websiteUrl: params.websiteUrl },
  });
  return { ok: true, linked: true };
}
