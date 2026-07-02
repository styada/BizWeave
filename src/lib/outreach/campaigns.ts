import { db } from "@/lib/db";
import { ensureMcpBootstrapped } from "@/lib/mcp";

export type SendSummary = {
  ok: boolean;
  campaignId: string;
  attempted: number;
  sent: number;
  skipped: number;
  needsApproval?: string; // pendingActionId if first send requires approval
};

/**
 * Send a campaign to eligible contacts. Every individual send goes through the
 * guarded comms MCP tools (email.send / sms.send), so approval + caps +
 * compliance (unsubscribe / consent) are enforced centrally.
 *
 * If the first send returns needs_approval, we stop and surface the pending
 * action — the owner approves once, then re-runs send.
 */
export async function sendCampaign(params: {
  campaignId: string;
  userId: string;
}): Promise<SendSummary> {
  const campaign = await db.campaign.findUnique({
    where: { id: params.campaignId },
    include: { business: { select: { id: true, userId: true } } },
  });
  if (!campaign) {
    return { ok: false, campaignId: params.campaignId, attempted: 0, sent: 0, skipped: 0 };
  }

  const businessId = campaign.businessId;
  const isEmail = campaign.channel === "email";
  const isSms = campaign.channel === "sms" || campaign.channel === "whatsapp";

  // Eligible contacts: not unsubscribed; consent for the channel.
  const contacts = await db.contact.findMany({
    where: {
      businessId,
      unsubscribedAt: null,
      ...(isEmail ? { email: { not: null }, consentEmail: true } : {}),
      ...(isSms ? { phone: { not: null }, consentSms: true } : {}),
    },
    take: 5000,
  });

  const mcp = ensureMcpBootstrapped();
  await db.campaign.update({ where: { id: campaign.id }, data: { status: "sending" } });

  let sent = 0;
  let skipped = 0;
  let attempted = 0;

  for (const contact of contacts) {
    attempted += 1;
    const ctx = { businessId, userId: params.userId, dryRun: false };
    const res = isEmail
      ? await mcp.invoke("email.send", {
          to: contact.email,
          subject: campaign.subject ?? campaign.name,
          body: campaign.body,
          contactId: contact.id,
        }, ctx)
      : await mcp.invoke("sms.send", {
          to: contact.phone,
          body: campaign.body,
          contactId: contact.id,
        }, ctx);

    if (res.status === "needs_approval") {
      await db.campaign.update({ where: { id: campaign.id }, data: { status: "scheduled" } });
      return {
        ok: false,
        campaignId: campaign.id,
        attempted,
        sent,
        skipped,
        needsApproval: res.pendingActionId,
      };
    }

    if (res.status === "ok") {
      sent += 1;
      await db.campaignSend.upsert({
        where: { campaignId_contactId: { campaignId: campaign.id, contactId: contact.id } },
        create: { campaignId: campaign.id, contactId: contact.id, status: "sent", sentAt: new Date() },
        update: { status: "sent", sentAt: new Date() },
      });
    } else {
      skipped += 1;
      await db.campaignSend.upsert({
        where: { campaignId_contactId: { campaignId: campaign.id, contactId: contact.id } },
        create: { campaignId: campaign.id, contactId: contact.id, status: "failed" },
        update: { status: "failed" },
      });
    }
  }

  await db.campaign.update({ where: { id: campaign.id }, data: { status: "sent" } });
  return { ok: true, campaignId: campaign.id, attempted, sent, skipped };
}
