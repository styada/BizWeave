import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { appUrl } from "@/lib/env";

const schema = z.object({
  tier: z.enum(["starter400", "growth600", "operator1500"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    select: { id: true, email: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const base = appUrl();
  const result = await createCheckoutSession({
    businessId: id,
    tier: parsed.data.tier,
    email: business.email ?? session.email,
    successUrl: `${base}/dashboard/${id}?billing=success`,
    cancelUrl: `${base}/dashboard/${id}?billing=cancelled`,
  });
  return NextResponse.json(result);
}
