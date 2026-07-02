import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wildcardRootDomain } from "@/lib/env";
import { shouldShowBacklink, backlinkHtml } from "@/lib/sites/backlink";

export const dynamic = "force-dynamic";

/**
 * Wildcard subdomain renderer: {slug}.bizweave.site → live Deployment.
 * Middleware rewrites subdomain hosts to /site/[slug].
 */
export default async function SubdomainSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const root = wildcardRootDomain();
  const subdomain = `${slug}.${root}`;

  const deployment = await db.deployment.findUnique({
    where: { subdomain },
    include: {
      business: {
        include: { site: true, subscription: { select: { tier: true } } },
      },
    },
  });

  const site = deployment?.business?.site;
  if (!deployment || deployment.status !== "live" || !site) {
    return new NextResponse("Site not found", { status: 404 });
  }

  const showBacklink = await shouldShowBacklink(deployment.businessId);
  const meta = site.meta ? (JSON.parse(site.meta) as { title?: string; description?: string }) : {};
  const title = meta.title ?? deployment.business?.name ?? slug;
  const backlink = showBacklink ? backlinkHtml() : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  ${meta.description ? `<meta name="description" content="${escapeHtml(meta.description)}" />` : ""}
  <style>${site.css}</style>
</head>
<body>
  ${site.html}
  ${backlink}
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
