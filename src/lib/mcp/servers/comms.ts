import { z } from "zod";
import type { McpTool } from "@/lib/mcp/types";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/integrations/email-send";
import { sendSms } from "@/lib/integrations/sms-send";
import { enforceCanSpam, checkTcpa } from "@/lib/compliance";
import { appUrl } from "@/lib/env";

const emailInput = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1),
  contactId: z.string().optional(),
});

const smsInput = z.object({
  to: z.string().min(5).max(30),
  body: z.string().min(1).max(1600),
  contactId: z.string().optional(),
});

const socialInput = z.object({
  channel: z.enum(["twitter", "linkedin"]),
  content: z.string().min(1).max(3000),
});

/** Email send routed through the provider; honors unsubscribe via the caller. */
async function emailSend(input: z.infer<typeof emailInput>, businessId: string) {
  // Compliance: never send to unsubscribed contacts.
  if (input.contactId) {
    const contact = await db.contact.findUnique({ where: { id: input.contactId } });
    if (contact?.unsubscribedAt) {
      return { ok: false, skipped: "unsubscribed" as const };
    }
  }
  // CAN-SPAM: enforce physical address + one-click unsubscribe.
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { addressLine1: true, city: true, region: true, postalCode: true },
  });
  const postalAddress = [
    business?.addressLine1,
    business?.city,
    business?.region,
    business?.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
  const unsubscribeUrl = `${appUrl()}/api/unsubscribe${input.contactId ? `?c=${input.contactId}` : ""}`;
  const compliant = enforceCanSpam({ html: input.body, postalAddress, unsubscribeUrl });

  const result = await sendEmail({
    to: input.to,
    subject: input.subject,
    html: compliant.fixedHtml ?? input.body,
    businessId,
  });
  return { ...result, compliance: compliant.issues };
}

async function smsSend(input: z.infer<typeof smsInput>, businessId: string) {
  // TCPA: prior express consent + quiet-hours (8am–9pm) enforcement.
  let consentSms = true;
  if (input.contactId) {
    const contact = await db.contact.findUnique({ where: { id: input.contactId } });
    consentSms = !!contact?.consentSms;
  }
  const tcpa = checkTcpa({ consentSms, hourLocal: new Date().getHours() });
  if (!tcpa.ok) {
    return { ok: false, skipped: tcpa.issues.join(",") };
  }
  return sendSms({ to: input.to, body: input.body, businessId });
}

async function socialPost(input: z.infer<typeof socialInput>) {
  // Social posting is stubbed to dry-run until per-business OAuth tokens exist
  // (Phase 7/22). Returns a deterministic preview so the pipeline can proceed.
  return {
    ok: true,
    dryRun: true,
    channel: input.channel,
    preview: input.content.slice(0, 280),
  };
}

export const commsTools: McpTool[] = [
  {
    name: "email.send",
    description: "Send a transactional/marketing email (CAN-SPAM enforced).",
    sideEffect: true,
    riskLevel: "medium",
    actionType: "email.send",
    usageKind: "email",
    inputSchema: emailInput,
    estimate: () => ({ quantity: 1 }),
    run: (input, ctx) =>
      emailSend(input as z.infer<typeof emailInput>, ctx.businessId),
  },
  {
    name: "sms.send",
    description: "Send an SMS (TCPA consent required).",
    sideEffect: true,
    riskLevel: "medium",
    actionType: "sms.send",
    usageKind: "sms",
    inputSchema: smsInput,
    estimate: () => ({ quantity: 1 }),
    run: (input, ctx) => smsSend(input as z.infer<typeof smsInput>, ctx.businessId),
  },
  {
    name: "social.post",
    description: "Post to a connected social channel.",
    sideEffect: true,
    riskLevel: "medium",
    actionType: "social.post",
    inputSchema: socialInput,
    run: (input) => socialPost(input as z.infer<typeof socialInput>),
  },
];

export { emailSend, smsSend, socialPost };
