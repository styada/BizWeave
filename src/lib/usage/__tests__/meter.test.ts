import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  subscription: { findUnique: vi.fn() },
  usageEvent: { findMany: vi.fn(), create: vi.fn() },
  creditWallet: { findUnique: vi.fn(), update: vi.fn() },
  creditLedger: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("usage meter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.subscription.findUnique.mockResolvedValue({
      tier: "starter400",
      entitlements: {
        tier: "starter400",
        emails: 2000,
        llmCreditsUsd: 15,
        managedAdSpendUsd: 0,
        agentTaskMinutes: 300,
        sandboxHours: 5,
        sms: 0,
        voiceMinutes: 0,
        sites: 1,
        domains: 1,
        connectors: 3,
        seats: 2,
      },
    });
    dbMock.usageEvent.findMany.mockResolvedValue([{ quantity: 100, costUsd: 0 }]);
    dbMock.usageEvent.create.mockResolvedValue({});
  });

  it("allows usage under cap", async () => {
    const { checkCap } = await import("@/lib/usage/meter");
    const result = await checkCap({
      businessId: "biz_1",
      kind: "email",
      addAmount: 1,
    });
    expect(result.allowed).toBe(true);
    expect(result.hard).toBe(false);
  });

  it("blocks when over cap and wallet empty", async () => {
    dbMock.usageEvent.findMany.mockResolvedValue(
      Array.from({ length: 2000 }, () => ({ quantity: 1, costUsd: 0 }))
    );
    dbMock.creditWallet.findUnique.mockResolvedValue({ balanceUsd: 0 });

    const { checkCap } = await import("@/lib/usage/meter");
    const result = await checkCap({
      businessId: "biz_1",
      kind: "email",
      addAmount: 1,
    });
    expect(result.allowed).toBe(false);
    expect(result.hard).toBe(true);
  });

  it("records usage events best-effort", async () => {
    const { recordUsage } = await import("@/lib/usage/meter");
    await recordUsage({ businessId: "biz_1", kind: "email", quantity: 1 });
    expect(dbMock.usageEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: "biz_1", kind: "email", quantity: 1 }),
      })
    );
  });
});
