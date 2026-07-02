import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  business: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  agentRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
  generatedSite: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  marketingPlan: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  agentLog: {
    create: vi.fn(),
  },
  approvalPolicy: {
    findUnique: vi.fn(),
  },
  pendingAction: {
    create: vi.fn(),
  },
  activityEvent: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

const getPreferredProviderMock = vi.fn();
vi.mock("@/lib/llm/keys", () => ({
  getPreferredProvider: getPreferredProviderMock,
}));

const completeMock = vi.fn();
vi.mock("@/lib/llm/client", () => ({
  complete: completeMock,
}));

describe("runAgentPipeline integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    dbMock.business.findFirst.mockResolvedValue({
      id: "biz_1",
      userId: "user_1",
      name: "Harbor Spirits",
      type: "retail-liquor",
      tagline: "Neighborhood favorites",
      description: "Local store",
      location: "Austin, TX",
      phone: "123",
      email: "hi@example.com",
      inventory: [
        {
          id: "inv_1",
          name: "Cabernet",
          price: 19.99,
          quantity: 5,
          category: "Wine",
          sku: "CAB-1",
        },
      ],
    });

    dbMock.agentRun.create.mockResolvedValue({ id: "run_1" });
    dbMock.agentRun.update.mockResolvedValue({});
    dbMock.business.update.mockResolvedValue({});
    dbMock.generatedSite.upsert.mockResolvedValue({});
    dbMock.generatedSite.updateMany.mockResolvedValue({});
    dbMock.marketingPlan.upsert.mockResolvedValue({});
    dbMock.marketingPlan.updateMany.mockResolvedValue({});
    dbMock.agentLog.create.mockResolvedValue({});
    dbMock.approvalPolicy.findUnique.mockResolvedValue(null);
    dbMock.pendingAction.create.mockResolvedValue({});
    dbMock.activityEvent.create.mockResolvedValue({});
  });

  it("completes in fallback mode when no provider is configured", async () => {
    getPreferredProviderMock.mockResolvedValue(null);

    const { runAgentPipeline } = await import("@/lib/agents/orchestrator");
    const result = await runAgentPipeline("biz_1", "user_1");

    expect(result.useLlm).toBe(false);
    expect(result.approved).toBe(true);
    expect(dbMock.agentLog.create).toHaveBeenCalled();
    expect(dbMock.generatedSite.upsert).toHaveBeenCalled();
  }, 30_000);

  it("uses fallback for malformed model output and still completes", async () => {
    getPreferredProviderMock.mockResolvedValue({
      provider: "openai",
      apiKey: "test-key",
    });
    completeMock.mockResolvedValue({
      provider: "openai",
      model: "gpt-4o-mini",
      content: "not valid json",
    });

    const { runAgentPipeline } = await import("@/lib/agents/orchestrator");
    const result = await runAgentPipeline("biz_1", "user_1");

    expect(result.approved).toBe(true);
    expect(result.useLlm).toBe(true);
    expect(dbMock.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ status: "complete" }),
      })
    );
  }, 30_000);
});
