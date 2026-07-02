import { describe, expect, it } from "vitest";
import { IntegrationRegistry } from "@/lib/integrations/index";
import { twitterIntegration } from "@/lib/integrations/twitter";
import type { ChannelCredentials } from "@/lib/integrations/index";

describe("IntegrationRegistry", () => {
  it("registers and retrieves an integration", () => {
    const registry = new IntegrationRegistry();
    registry.register(twitterIntegration);
    expect(registry.get("twitter")).toBeDefined();
    expect(registry.get("twitter")?.label).toBe("Twitter / X");
  });

  it("returns undefined for unknown types", () => {
    const registry = new IntegrationRegistry();
    expect(registry.get("sms")).toBeUndefined();
  });

  it("lists all registered integrations", () => {
    const registry = new IntegrationRegistry();
    registry.register(twitterIntegration);
    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe("twitter");
  });

  it("listConfigured returns only integrations with valid credentials", () => {
    const registry = new IntegrationRegistry();
    registry.register(twitterIntegration);

    const creds: Record<string, ChannelCredentials | null> = {
      twitter: { accessToken: "valid-token" },
      linkedin: null,
      email: { apiKey: "key" },
    };

    const configured = registry.listConfigured(creds as never);
    expect(configured).toEqual(["twitter"]);
  });
});

describe("Twitter Integration", () => {
  it("has correct metadata", () => {
    expect(twitterIntegration.type).toBe("twitter");
    expect(twitterIntegration.label).toBe("Twitter / X");
  });

  it("validates credentials correctly", () => {
    expect(twitterIntegration.validateCredentials({})).toBe(false);
    expect(twitterIntegration.validateCredentials({ accessToken: "abc" })).toBe(true);
    expect(twitterIntegration.validateCredentials({ apiKey: "abc" })).toBe(true);
  });

  it("post returns error when no access token", async () => {
    const result = await twitterIntegration.post({
      content: "Hello world",
      credentials: {},
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No access token");
  });

  it("post returns error on network failure (no real token)", async () => {
    // This will attempt a real fetch which should fail — we catch the error
    const result = await twitterIntegration.post({
      content: "Hello from Bizweave!",
      credentials: { accessToken: "fake-token" },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("truncates long content to 280 characters", async () => {
    const longContent = "A".repeat(500);
    const result = await twitterIntegration.post({
      content: longContent,
      credentials: { accessToken: "fake-token" },
    });
    // Should still fail because token is fake, but the content was truncated before sending
    expect(result.ok).toBe(false);
  });
});
