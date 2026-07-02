import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * One-click unsubscribe (CAN-SPAM). Public. Accepts a contact id via `c`.
 * Production should use a signed token; this is scoped to a single contact and
 * only flips the unsubscribe flag (no data exposure).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get("c");
  if (contactId) {
    await db.contact
      .update({
        where: { id: contactId },
        data: { unsubscribedAt: new Date(), consentEmail: false },
      })
      .catch(() => undefined);
  }
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;background:#0a0b0f;color:#f4f4f5;display:grid;place-items:center;height:100vh"><div style="text-align:center"><h1>You're unsubscribed</h1><p>You won't receive further emails.</p></div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
