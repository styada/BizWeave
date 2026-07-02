import { db } from "@/lib/db";
import { loadBusinessContext } from "@/lib/executor/context";
import { buildTemplateSite, slugFromName } from "@/lib/sites/templates";
import { ensureMcpBootstrapped } from "@/lib/mcp";

/**
 * Free-tier launch path: build a template site, persist it, and publish at
 * {slug}.bizweave.site with the SEO backlink enabled.
 */
export async function launchFreeTierSite(params: {
  businessId: string;
  userId: string;
  templateId?: "classic" | "minimal" | "bold";
}): Promise<{ url: string; deploymentId: string }> {
  const ctx = await loadBusinessContext(params.businessId);
  if (!ctx) throw new Error("Business not found");

  const site = buildTemplateSite(ctx, params.templateId ?? "classic", { includeBacklink: true });

  await db.generatedSite.upsert({
    where: { businessId: params.businessId },
    create: {
      businessId: params.businessId,
      html: site.html,
      css: site.css,
      meta: JSON.stringify(site.meta),
      status: "live",
    },
    update: {
      html: site.html,
      css: site.css,
      meta: JSON.stringify(site.meta),
      status: "live",
    },
  });

  const slug = slugFromName(ctx.name);
  const mcp = ensureMcpBootstrapped();
  const deployed = await mcp.invoke(
    "deploy.subdomain",
    { slug, publish: true },
    { businessId: params.businessId, userId: params.userId, dryRun: false }
  );

  if (deployed.status === "ok" && deployed.output && typeof deployed.output === "object") {
    const out = deployed.output as { deploymentId?: string; url?: string };
    await db.deployment.updateMany({
      where: { businessId: params.businessId },
      data: { isTemplate: true, backlinkEnabled: true, templateId: params.templateId ?? "classic" },
    });
    return {
      url: out.url ?? `https://${slug}.bizweave.site`,
      deploymentId: out.deploymentId ?? "",
    };
  }

  return { url: `https://${slug}.bizweave.site`, deploymentId: "" };
}
