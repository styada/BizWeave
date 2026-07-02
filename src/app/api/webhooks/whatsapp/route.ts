import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleOperatorMessage } from "@/lib/chat/operator";

/**
 * WhatsApp bridge via Twilio (application/x-www-form-urlencoded). Maps the
 * sender number to a business through MessagingBridge and routes the message to
 * the operator; replies via TwiML.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const from = (form.get("From") as string | null)?.replace(/^whatsapp:/, "").trim();
    const body = (form.get("Body") as string | null)?.trim();
    if (!from || !body) return twiml("");

    const bridge = await db.messagingBridge.findUnique({
      where: { provider_externalId: { provider: "whatsapp", externalId: from } },
      include: { business: { select: { id: true, userId: true } } },
    });
    if (!bridge) {
      return twiml("This number isn't linked to a Bizweave business. Link WhatsApp from your dashboard to continue.");
    }

    const reply = await handleOperatorMessage({
      businessId: bridge.business.id,
      userId: bridge.business.userId,
      text: body,
      channel: "whatsapp",
    });
    return twiml(reply.reply);
  } catch {
    return twiml("");
  }
}

function twiml(message: string): NextResponse {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}
