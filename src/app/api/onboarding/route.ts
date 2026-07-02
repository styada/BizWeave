import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validations";
import { composeAddress, geocodeAddress } from "@/lib/geo/geocode";
import { bootstrapBusinessAutomation } from "@/lib/scheduler";

/**
 * Onboarding v2 — creates a physical local business with full detail, geocodes
 * the address, seeds guardrail ApprovalPolicies, and bootstraps automation.
 * The client then calls POST /api/businesses/[id]/run to launch the pipeline.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const singleLine = composeAddress(d);
    const geo = singleLine ? await geocodeAddress(singleLine) : null;

    const business = await db.business.create({
      data: {
        userId: session.id,
        name: d.name,
        type: d.type,
        tagline: d.tagline || null,
        description: d.description || null,
        location: singleLine || null,
        phone: d.phone || null,
        email: d.email || null,
        status: "draft",
        addressLine1: d.addressLine1 || null,
        addressLine2: d.addressLine2 || null,
        city: d.city || null,
        region: d.region || null,
        postalCode: d.postalCode || null,
        country: d.country || "US",
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        hours: d.hours ?? undefined,
        serviceArea: d.serviceArea || null,
        posSystem: d.posSystem || null,
        orderMgmtSystem: d.orderMgmtSystem || null,
        websiteUrl: d.websiteUrl || null,
        googleBusinessProfileId: d.googleBusinessProfileId || null,
        socialHandles: d.socialHandles ?? undefined,
        categories: d.categories ?? undefined,
      },
    });

    // Seed guardrail approval policies from the owner's choices.
    const policies: {
      actionType: string;
      requiresApproval: boolean;
      minRiskLevel: string;
    }[] = [];
    if (d.requireApprovalForSends) {
      for (const actionType of ["email.send", "sms.send", "social.post"]) {
        policies.push({ actionType, requiresApproval: true, minRiskLevel: "low" });
      }
    }
    if (d.requireApprovalForSpend) {
      for (const actionType of ["ads.spend", "purchase"]) {
        policies.push({ actionType, requiresApproval: true, minRiskLevel: "low" });
      }
    }
    if (policies.length > 0) {
      await db.approvalPolicy.createMany({
        data: policies.map((p) => ({ businessId: business.id, ...p })),
        skipDuplicates: true,
      });
    }

    // Free-tier subscription with default entitlements + guardrail budget cap.
    await db.subscription
      .create({
        data: {
          businessId: business.id,
          tier: "free",
          status: "active",
          entitlements: entitlementsForTier("free"),
        },
      })
      .catch(() => undefined);

    if (d.monthlyBudgetCapUsd !== undefined) {
      await db.procurementPolicy
        .create({
          data: {
            businessId: business.id,
            vendor: "*",
            monthlyCapUsd: d.monthlyBudgetCapUsd,
            perPurchaseCapUsd: Math.min(d.monthlyBudgetCapUsd, 50),
            requiresApproval: d.requireApprovalForSpend,
          },
        })
        .catch(() => undefined);
    }

    await bootstrapBusinessAutomation(business.id);

    await db.auditLog
      .create({
        data: {
          businessId: business.id,
          actorType: "user",
          actorId: session.id,
          action: "onboarding.authorize_operator",
          riskLevel: "high",
          after: { authorizeOperator: true, terms: "/legal/terms" },
        },
      })
      .catch(() => undefined);

    // Free tier: instant template site + subdomain with SEO backlink (Phase 14).
    import("@/lib/sites/launch-free")
      .then((m) => m.launchFreeTierSite({ businessId: business.id, userId: session.id }))
      .catch(() => undefined);

    // Attach to a workspace for multi-business portfolio (Phase 17).
    import("@/lib/workspace")
      .then((m) => m.ensureWorkspace(session.id, business.id, `${d.name} Workspace`))
      .catch(() => undefined);

    // Seed PAYG credit wallet (Phase 27).
    await db.creditWallet
      .create({ data: { businessId: business.id, balanceUsd: 0 } })
      .catch(() => undefined);

    // Seed competitor intel in the background if we have coordinates.
    if (geo) {
      import("@/lib/competitors/refresh")
        .then((m) => m.refreshCompetitors(business.id, session.id))
        .catch(() => undefined);
    }

    return NextResponse.json({
      business: { id: business.id },
      geocoded: !!geo,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}

// Local copy to avoid a circular import into the billing module before it exists.
function entitlementsForTier(tier: string) {
  const map: Record<string, Record<string, number | string>> = {
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
  };
  return map[tier] ?? map.free;
}
