import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendCampaign } from "@/lib/outreach/campaigns";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; campaignId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, campaignId } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, businessId: id },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const summary = await sendCampaign({ campaignId, userId: session.id });
  return NextResponse.json(summary);
}
