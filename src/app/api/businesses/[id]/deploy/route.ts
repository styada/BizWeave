import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMcpBootstrapped } from "@/lib/mcp";
import { verifyVercelDomain } from "@/lib/hosting/vercel";
import { linkWebsiteToGbp } from "@/lib/hosting/gbp";

const deploySchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("subdomain"), slug: z.string().min(1).max(63).optional() }),
  z.object({ target: z.literal("custom"), domain: z.string().min(3).max(253) }),
  z.object({ target: z.literal("verify"), domain: z.string().min(3).max(253) }),
  z.object({ target: z.literal("gbp") }),
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({ where: { id, userId: session.id }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deployments = await db.deployment.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ deployments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    select: { id: true, name: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = deploySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const body = parsed.data;
  const mcp = ensureMcpBootstrapped();

  if (body.target === "subdomain") {
    const slug = body.slug ?? business.name;
    const result = await mcp.invoke(
      "deploy.subdomain",
      { slug, publish: true },
      { businessId: id, userId: session.id, dryRun: false }
    );
    return NextResponse.json(result);
  }

  if (body.target === "custom") {
    const result = await mcp.invoke(
      "deploy.attachDomain",
      { domain: body.domain },
      { businessId: id, userId: session.id, dryRun: false }
    );
    return NextResponse.json(result);
  }

  if (body.target === "verify") {
    const result = await verifyVercelDomain(body.domain);
    if (result.verified) {
      await db.deployment
        .updateMany({ where: { businessId: id, domain: body.domain }, data: { status: "live" } })
        .catch(() => undefined);
    }
    return NextResponse.json(result);
  }

  // gbp: link the current live site to the Google Business Profile
  const deployment = await db.deployment.findFirst({
    where: { businessId: id, status: "live" },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  if (!deployment?.url) {
    return NextResponse.json({ ok: false, reason: "no_live_site" }, { status: 400 });
  }
  const linked = await linkWebsiteToGbp({ businessId: id, websiteUrl: deployment.url });
  return NextResponse.json(linked);
}
