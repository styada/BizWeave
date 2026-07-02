import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  business: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
  approvalPolicy: { findUnique: vi.fn() },
  procurementPolicy: { findUnique: vi.fn() },
  purchase: { findMany: vi.fn(), create: vi.fn() },
  pendingAction: { create: vi.fn() },
  activityEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  usageEvent: { create: vi.fn(), findMany: vi.fn() },
  creditWallet: { findUnique: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const recordUsageMock = vi.fn();
const checkCapMock = vi.fn();
vi.mock("@/lib/usage/meter", () => ({
  checkCap: checkCapMock,
  recordUsage: recordUsageMock,
  debitWallet: vi.fn(),
}));

const pushMock = vi.fn();
vi.mock("@/lib/notify/push", () => ({
  pushToBusinessOwner: pushMock,
}));

describe("guardAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.business.findUnique.mockResolvedValue({ status: "active" });
    dbMock.subscription.findUnique.mockResolvedValue({ status: "active" });
    dbMock.approvalPolicy.findUnique.mockResolvedValue(null);
    dbMock.procurementPolicy.findUnique.mockResolvedValue(null);
    dbMock.pendingAction.create.mockResolvedValue({ id: "pa_1" });
    dbMock.activityEvent.create.mockResolvedValue({});
    dbMock.auditLog.create.mockResolvedValue({});
    dbMock.usageEvent.create.mockResolvedValue({});
    checkCapMock.mockResolvedValue({ allowed: true, ratio: 0, soft: false, hard: false, paidFromWallet: false });
    pushMock.mockResolvedValue({ sent: 0 });
  });

  it("blocks when business is frozen", async () => {
    dbMock.business.findUnique.mockResolvedValue({ status: "frozen" });

    const { guardAction } = await import("@/lib/guard/guard");
    const result = await guardAction({
      businessId: "biz_1",
      userId: "user_1",
      actionType: "email.send",
      riskLevel: "low",
      payload: {},
      execute: async () => ({ ok: true }),
    });

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("BUSINESS_FROZEN");
    }
  });

  it("returns needs_approval for medium-risk actions without policy", async () => {
    const { guardAction } = await import("@/lib/guard/guard");
    const result = await guardAction({
      businessId: "biz_1",
      userId: "user_1",
      actionType: "email.send",
      riskLevel: "medium",
      payload: { to: "a@b.com" },
      execute: async () => ({ ok: true }),
    });

    expect(result.status).toBe("needs_approval");
    expect(dbMock.pendingAction.create).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalled();
  });

  it("executes low-risk actions and records audit log", async () => {
    const { guardAction } = await import("@/lib/guard/guard");
    const result = await guardAction({
      businessId: "biz_1",
      userId: "user_1",
      actionType: "site.preview",
      riskLevel: "low",
      payload: {},
      execute: async () => ({ previewed: true }),
    });

    expect(result.status).toBe("executed");
    expect(dbMock.auditLog.create).toHaveBeenCalled();
  });

  it("supports dry_run without executing", async () => {
    const { guardAction } = await import("@/lib/guard/guard");
    const executed = vi.fn();
    const result = await guardAction({
      businessId: "biz_1",
      userId: "user_1",
      actionType: "email.send",
      riskLevel: "low",
      payload: { test: true },
      dryRun: true,
      execute: executed,
    });

    expect(result.status).toBe("dry_run");
    expect(executed).not.toHaveBeenCalled();
  });
});
