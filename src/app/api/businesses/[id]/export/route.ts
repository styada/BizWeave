import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Data-portability export (GDPR/CCPA). Returns a full JSON snapshot of the
 * business and all owned records so customers are never locked in.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    include: {
      inventory: true,
      site: true,
      marketing: true,
      brandKit: true,
      competitors: true,
      deployments: true,
      agentTasks: true,
      conversations: { include: { messages: true } },
      contacts: true,
      campaigns: { include: { sends: true } },
      adCampaigns: { include: { creatives: true, spend: true } },
      phoneAgents: { include: { callLogs: true } },
      subscription: { include: { invoices: true } },
      creditWallet: { include: { ledger: true } },
      approvalPolicies: true,
      pendingActions: true,
      scheduledTasks: true,
      activityEvents: true,
      usageEvents: true,
      auditLogs: true,
    },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), business }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="bizweave-export-${id}.json"`,
    },
  });
}
