import { optionalEnv, appUrl } from "@/lib/env";

export type EmailSendResult = {
  ok: boolean;
  providerId?: string;
  dryRun?: boolean;
  error?: string;
};

/**
 * Send an email via Resend. Degrades to a logged dry-run when RESEND_API_KEY is
 * absent so flows work end-to-end in development without a provider.
 *
 * CAN-SPAM: a physical address + unsubscribe footer must be included by the
 * caller/campaign builder; this fn appends a minimal footer if missing.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  businessId?: string;
}): Promise<EmailSendResult> {
  const key = optionalEnv("RESEND_API_KEY");
  const from = params.from ?? "Bizweave <hello@bizweave.site>";
  const html = ensureFooter(params.html);

  if (!key) {
    console.log(`[email:dry-run] to=${params.to} subject="${params.subject}"`);
    return { ok: true, dryRun: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: params.to, subject: params.subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, providerId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function ensureFooter(html: string): string {
  if (html.toLowerCase().includes("unsubscribe")) return html;
  return `${html}<hr/><p style="font-size:12px;color:#888">You are receiving this because you opted in. <a href="${appUrl()}/unsubscribe">Unsubscribe</a>.</p>`;
}
