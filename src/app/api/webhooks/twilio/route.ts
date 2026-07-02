import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Twilio inbound SMS webhook. Handles TCPA STOP/HELP keywords: STOP revokes SMS
 * consent for the matching contact(s); START re-grants it. Returns TwiML.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const from = String(form.get("From") ?? "");
    const bodyRaw = String(form.get("Body") ?? "").trim().toUpperCase();

    if (from) {
      if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(bodyRaw)) {
        await db.contact.updateMany({
          where: { phone: from },
          data: { consentSms: false },
        });
      } else if (["START", "YES", "UNSTOP"].includes(bodyRaw)) {
        await db.contact.updateMany({
          where: { phone: from },
          data: { consentSms: true },
        });
      }
    }

    const reply =
      bodyRaw === "HELP"
        ? "Bizweave: For help contact your business. Reply STOP to opt out."
        : "";
    const twiml = reply
      ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`
      : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  } catch {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
