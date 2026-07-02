/**
 * Email Integration (SMTP)
 *
 * Sends transactional and campaign emails via Nodemailer-compatible SMTP.
 *
 * TODO: Install nodemailer and wire up for production email sends.
 *       For now, logs to console and returns a mock result.
 */

import type { ChannelIntegration, ChannelCredentials, PostResult } from "./index";

export const emailIntegration: ChannelIntegration = {
  type: "email",
  label: "Email (SMTP)",
  description: "Send transactional and campaign emails",

  validateCredentials(creds: ChannelCredentials): boolean {
    return !!(creds.apiKey && creds.apiSecret);
  },

  async post({
    content,
    credentials,
    metadata,
  }: {
    content: string;
    credentials: ChannelCredentials;
    mediaUrls?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<PostResult> {
    if (!credentials.apiKey) {
      return { ok: false, error: "No SMTP credentials configured" };
    }

    // TODO: Implement actual SMTP send via nodemailer or Resend/SendGrid API
    console.log("[email-integration] Would send email:", {
      to: metadata?.to ?? "unknown",
      subject: metadata?.subject ?? "No subject",
      content: content.slice(0, 200),
    });

    return {
      ok: true,
      externalId: `mock-${Date.now()}`,
    };
  },
};
