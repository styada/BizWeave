import { db } from "@/lib/db";
import { appUrl, flags } from "@/lib/env";
import type { Tier } from "@/lib/types/entitlements";

/**
 * Free-tier SEO flywheel: a trademarked dofollow "Website by Bizweave" backlink.
 * Paid tiers can disable it via Deployment.backlinkEnabled or tier entitlement.
 */
export async function shouldShowBacklink(businessId: string): Promise<boolean> {
  if (!flags.backlinkFreeTier) return false;

  const [sub, deployment] = await Promise.all([
    db.subscription.findUnique({ where: { businessId }, select: { tier: true } }),
    db.deployment.findFirst({
      where: { businessId, status: "live" },
      orderBy: { createdAt: "desc" },
      select: { backlinkEnabled: true },
    }),
  ]);

  const tier = (sub?.tier ?? "free") as Tier;
  if (tier !== "free") return deployment?.backlinkEnabled ?? false;
  return deployment?.backlinkEnabled ?? true;
}

/** Inline HTML footer with a dofollow link (injected into generated site body). */
export function backlinkHtml(): string {
  const href = appUrl();
  return `<footer class="bizweave-backlink" style="text-align:center;padding:1rem;font-size:0.75rem;color:#888;border-top:1px solid rgba(255,255,255,0.06)">
  <a href="${href}" rel="dofollow" target="_blank" style="color:#7c5cff;text-decoration:none;font-weight:600">Website by Bizweave™</a>
</footer>`;
}
