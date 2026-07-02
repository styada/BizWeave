import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  integrationConnection: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const twitterPostMock = vi.fn();
vi.mock("@/lib/integrations/twitter", () => ({
  twitterIntegration: {
    post: twitterPostMock,
  },
}));

const linkedinPostMock = vi.fn();
vi.mock("@/lib/integrations/linkedin", () => ({
  linkedinIntegration: {
    post: linkedinPostMock,
  },
}));

describe("MCP comms: social.post dispatch (Phase H)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dry-run preview when no token is configured", async () => {
    dbMock.integrationConnection.findFirst.mockResolvedValue(null);
    const { commsTools } = await import("@/lib/mcp/servers/comms");
    const tool = commsTools.find((t) => t.name === "social.post");
    expect(tool).toBeDefined();
    const result = await tool!.run(
      { channel: "twitter", content: "Hello world from Phase H" },
      { businessId: "biz_1", userId: "user_1", dryRun: false }
    );
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.preview).toBe("Hello world from Phase H");
    expect(twitterPostMock).not.toHaveBeenCalled();
  });

  it("calls real twitterIntegration.post when a token is configured", async () => {
    dbMock.integrationConnection.findFirst.mockResolvedValue({
      channel: "twitter",
      accessToken: "tw_token_abc",
    });
    twitterPostMock.mockResolvedValue({
      ok: true,
      externalId: "12345",
      url: "https://twitter.com/i/status/12345",
    });
    const { commsTools } = await import("@/lib/mcp/servers/comms");
    const tool = commsTools.find((t) => t.name === "social.post");
    const result = await tool!.run(
      { channel: "twitter", content: "Live post" },
      { businessId: "biz_2", userId: "user_1", dryRun: false }
    );
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("12345");
    expect(result.url).toContain("twitter.com");
    expect(twitterPostMock).toHaveBeenCalledWith({
      content: "Live post",
      credentials: { accessToken: "tw_token_abc" },
    });
  });

  it("truncates preview to 280 chars in dry-run", async () => {
    dbMock.integrationConnection.findFirst.mockResolvedValue(null);
    const { commsTools } = await import("@/lib/mcp/servers/comms");
    const tool = commsTools.find((t) => t.name === "social.post");
    const long = "a".repeat(500);
    const result = await tool!.run(
      { channel: "twitter", content: long },
      { businessId: "biz_3", userId: "user_1", dryRun: false }
    );
    expect(result.preview.length).toBe(280);
  });
});
