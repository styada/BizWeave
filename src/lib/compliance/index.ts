/**
 * Channel-compliance checks enforced in code (not just policy). Used by the
 * comms tools, ads engine, and site builder before anything goes out.
 */

export type ComplianceResult = { ok: boolean; issues: string[]; fixedHtml?: string };

/**
 * CAN-SPAM: commercial email must include a physical postal address and a
 * working one-click unsubscribe. Returns issues and an auto-repaired body.
 */
export function enforceCanSpam(params: {
  html: string;
  postalAddress?: string | null;
  unsubscribeUrl: string;
}): ComplianceResult {
  const issues: string[] = [];
  let html = params.html;

  const hasUnsub = /unsubscribe/i.test(html);
  const hasAddress = params.postalAddress
    ? html.includes(params.postalAddress)
    : /\d{1,5}\s+\w+/.test(html);

  if (!hasUnsub || !hasAddress) {
    const addr = params.postalAddress
      ? `<div>${escapeHtml(params.postalAddress)}</div>`
      : "";
    html += `<hr/><div style="font-size:12px;color:#888">${addr}<div><a href="${params.unsubscribeUrl}">Unsubscribe</a> at any time.</div></div>`;
    if (!hasUnsub) issues.push("missing_unsubscribe");
    if (!hasAddress) issues.push("missing_physical_address");
  }

  return { ok: issues.length === 0, issues, fixedHtml: html };
}

/**
 * TCPA: SMS/voice require prior express consent and must respect quiet hours
 * (before 8am / after 9pm in the recipient's local time). `hourLocal` is the
 * recipient-local hour (0-23); pass undefined to skip the quiet-hours check.
 */
export function checkTcpa(params: {
  consentSms: boolean;
  hourLocal?: number;
}): ComplianceResult {
  const issues: string[] = [];
  if (!params.consentSms) issues.push("no_sms_consent");
  if (typeof params.hourLocal === "number" && (params.hourLocal < 8 || params.hourLocal >= 21)) {
    issues.push("quiet_hours");
  }
  return { ok: issues.length === 0, issues };
}

/**
 * Lightweight WCAG audit for generated site HTML. Catches the most common
 * failures (missing lang, alt text, title, form labels, viewport). Not a
 * replacement for axe-core, but a fast pre-publish gate.
 */
export function auditWcag(html: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!/<html[^>]*\blang=/i.test(html)) issues.push("html_missing_lang");
  if (!/<title>/i.test(html)) issues.push("missing_title");
  if (!/name=["']viewport["']/i.test(html)) issues.push("missing_viewport");

  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const imgsMissingAlt = imgs.filter((t) => !/\balt=/i.test(t)).length;
  if (imgsMissingAlt > 0) issues.push(`img_missing_alt:${imgsMissingAlt}`);

  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  const inputsNoLabel = inputs.filter(
    (t) => !/\baria-label=/i.test(t) && !/type=["'](hidden|submit|button)["']/i.test(t)
  ).length;
  if (inputsNoLabel > 0 && !/<label\b/i.test(html)) issues.push("form_inputs_unlabeled");

  return { ok: issues.length === 0, issues };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
