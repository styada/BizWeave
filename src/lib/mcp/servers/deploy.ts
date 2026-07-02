import { z } from "zod";
import type { McpTool } from "@/lib/mcp/types";
import { db } from "@/lib/db";
import { wildcardRootDomain } from "@/lib/env";
import { attachVercelDomain } from "@/lib/hosting/vercel";

const subdomainInput = z.object({
  slug: z.string().min(1).max(63),
  publish: z.boolean().default(true),
});

const customDomainInput = z.object({
  domain: z.string().min(3).max(253),
});

/**
 * Publish the current GeneratedSite at {slug}.bizweave.site (DB/edge-served,
 * no build step) and mark it live. This is the zero-config default host.
 */
async function deploySubdomain(
  input: z.infer<typeof subdomainInput>,
  businessId: string
) {
  const root = wildcardRootDomain();
  const subdomain = `${slugify(input.slug)}.${root}`;
  const url = `https://${subdomain}`;

  const deployment = await db.deployment.upsert({
    where: { subdomain },
    create: {
      businessId,
      target: "subdomain",
      subdomain,
      url,
      status: "live",
      provider: "edge",
    },
    update: { status: "live", url },
  });

  if (input.publish) {
    await db.generatedSite
      .update({ where: { businessId }, data: { status: "live" } })
      .catch(() => undefined);
  }

  return { deploymentId: deployment.id, url, status: "live" as const };
}

/** Attach a customer-owned custom domain (records intent; DNS verify later). */
async function attachCustomDomain(
  input: z.infer<typeof customDomainInput>,
  businessId: string
) {
  const attach = await attachVercelDomain(input.domain);
  const deployment = await db.deployment.create({
    data: {
      businessId,
      target: "custom",
      domain: input.domain,
      url: `https://${input.domain}`,
      status: attach.verified ? "live" : "building",
      provider: "vercel",
    },
  });
  const cname = attach.verification?.find((v) => v.type === "CNAME");
  return {
    deploymentId: deployment.id,
    domain: input.domain,
    status: attach.verified ? ("live" as const) : ("pending_verification" as const),
    dnsInstructions: {
      type: cname?.type ?? "CNAME",
      name: cname?.domain ?? input.domain,
      value: cname?.value ?? "cname.vercel-dns.com",
    },
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export const deployTools: McpTool[] = [
  {
    name: "deploy.subdomain",
    description:
      "Publish the business website live at {slug}.bizweave.site and mark it live.",
    sideEffect: true,
    riskLevel: "medium",
    actionType: "site.publish",
    inputSchema: subdomainInput,
    run: (input, ctx) =>
      deploySubdomain(input as z.infer<typeof subdomainInput>, ctx.businessId),
  },
  {
    name: "deploy.attachDomain",
    description: "Attach a customer-owned custom domain to the site.",
    sideEffect: true,
    riskLevel: "high",
    actionType: "domain.attach",
    inputSchema: customDomainInput,
    run: (input, ctx) =>
      attachCustomDomain(input as z.infer<typeof customDomainInput>, ctx.businessId),
  },
];

export { deploySubdomain, attachCustomDomain };
