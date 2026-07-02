import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  business: { findUnique: vi.fn() },
  pendingAction: { count: vi.fn() },
  agentTask: { count: vi.fn() },
  featureRequest: { create: vi.fn() },
  activityEvent: { create: vi.fn() },
  callLog: { count: vi.fn() },
  campaignSend: { count: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/ads/engine", () => ({
  computeRoas: vi.fn(async () => ({ spendUsd: 0, conversions: 0, clicks: 0, impressions: 0 })),
}));

vi.mock("@/lib/llm/resolve", () => ({
  resolveLlm: vi.fn(async () => null),
}));

vi.mock("@/lib/env", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...orig,
    flags: { ...orig.flags, dreaming: true },
  };
});

describe("runDreamingCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.business.findUnique.mockResolvedValue({ name: "Joe's Coffee" });
    dbMock.pendingAction.count.mockResolvedValue(0);
    dbMock.agentTask.count.mockResolvedValue(0);
    dbMock.featureRequest.create.mockResolvedValue({});
    dbMock.activityEvent.create.mockResolvedValue({});
    dbMock.callLog.count.mockResolvedValue(0);
    dbMock.campaignSend.count.mockResolvedValue(0);
  });

  it("returns healthy mood with no issues", async () => {
    const { runDreamingCycle } = await import("@/lib/dreaming/cycle");
    const result = await runDreamingCycle("biz_1", "user_1");
    expect(result.mood).toBe("healthy");
    expect(result.brief).toContain("Joe");
  });

  it("flags critical mood when many failures", async () => {
    dbMock.agentTask.count.mockResolvedValue(5);
    dbMock.pendingAction.count.mockResolvedValue(6);

    const { runDreamingCycle } = await import("@/lib/dreaming/cycle");
    const result = await runDreamingCycle("biz_1", "user_1");
    expect(result.mood).toBe("critical");
    expect(result.proposals.length).toBeGreaterThan(0);
  });
});
