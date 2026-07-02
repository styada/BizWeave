import { optionalEnv } from "@/lib/env";

export type SmsSendResult = {
  ok: boolean;
  providerId?: string;
  dryRun?: boolean;
  error?: string;
};

/**
 * Send an SMS via Twilio. Degrades to a logged dry-run when Twilio credentials
 * are absent. TCPA: caller must verify consent + honor STOP before invoking.
 */
export async function sendSms(params: {
  to: string;
  body: string;
  businessId?: string;
}): Promise<SmsSendResult> {
  const sid = optionalEnv("TWILIO_ACCOUNT_SID");
  const token = optionalEnv("TWILIO_AUTH_TOKEN");
  const messagingServiceSid = optionalEnv("TWILIO_MESSAGING_SERVICE_SID");

  // Quiet hours guard (TCPA): no sends 9pm–8am recipient-local is enforced by
  // the campaign scheduler; here we only handle transport.
  if (!sid || !token || !messagingServiceSid) {
    console.log(`[sms:dry-run] to=${params.to} body="${params.body.slice(0, 40)}"`);
    return { ok: true, dryRun: true };
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams({
      To: params.to,
      MessagingServiceSid: messagingServiceSid,
      Body: params.body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) {
      return { ok: false, error: `Twilio ${res.status}: ${await res.text()}` };
    }
    const data = (await res.json()) as { sid?: string };
    return { ok: true, providerId: data.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
