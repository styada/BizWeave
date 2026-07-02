import { describe, it, expect } from "vitest";
import { enforceCanSpam, checkTcpa, auditWcag } from "@/lib/compliance";

describe("enforceCanSpam", () => {
  it("flags and repairs missing unsubscribe + address", () => {
    const r = enforceCanSpam({ html: "<p>Hi</p>", postalAddress: "1 Main St, Austin, TX", unsubscribeUrl: "https://x/unsub" });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("missing_unsubscribe");
    expect(r.fixedHtml).toContain("Unsubscribe");
    expect(r.fixedHtml).toContain("1 Main St");
  });

  it("passes when compliant", () => {
    const html = '<p>Hi</p><div>1 Main St, Austin, TX</div><a href="u">unsubscribe</a>';
    const r = enforceCanSpam({ html, postalAddress: "1 Main St, Austin, TX", unsubscribeUrl: "u" });
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });
});

describe("checkTcpa", () => {
  it("blocks without consent", () => {
    expect(checkTcpa({ consentSms: false }).ok).toBe(false);
  });
  it("blocks during quiet hours", () => {
    expect(checkTcpa({ consentSms: true, hourLocal: 23 }).issues).toContain("quiet_hours");
    expect(checkTcpa({ consentSms: true, hourLocal: 6 }).issues).toContain("quiet_hours");
  });
  it("allows with consent during daytime", () => {
    expect(checkTcpa({ consentSms: true, hourLocal: 12 }).ok).toBe(true);
  });
});

describe("auditWcag", () => {
  it("flags missing lang/title/alt", () => {
    const r = auditWcag('<html><body><img src="a.png"></body></html>');
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("html_missing_lang");
    expect(r.issues.some((i) => i.startsWith("img_missing_alt"))).toBe(true);
  });

  it("passes a compliant document", () => {
    const html =
      '<html lang="en"><head><title>T</title><meta name="viewport" content="width=device-width"></head><body><img src="a" alt="a"></body></html>';
    expect(auditWcag(html).ok).toBe(true);
  });
});
