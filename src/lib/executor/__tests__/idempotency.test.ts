import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  agentTask: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversation: { findUnique: vi.fn(), create: vi.fn() },
  message: { create: vi.fn() },
  activityEvent: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/usage/meter", () => ({ recordUsage: vi.fn() }));
vi.mock("@/lib/notify/push", () => ({ pushToBusinessOwner: vi.fn() }));
vi.mock("@/lib/executor/context", () => ({
  loadBusinessContext: vi.fn(async () => ({ id: "biz_1", name: "Test", type: "cafe" })),
}));
vi.mock("@/lib/executor/sandbox", () => ({
  createSandbox: vi.fn(async () => ({ available: false, id: null })),
  destroySandbox: vi.fn(async () => undefined),
}));
vi.mock("@/lib/executor/verify", () => ({
  verifyCompletion: vi.fn(async () => ({ verified: true })),
}));

describe("runTask idempotency (Phase J)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the in-flight task instead of creating a duplicate", async () => {
    // Existing in-flight task with the same key.
    dbMock.agentTask.findFirst.mockResolvedValue({
      id: "task_existing",
      status: "running",
    });
    const { runTask } = await import("@/lib/executor/router");
    const result = await runTask({
      businessId: "biz_1",
      userId: "user_1",
      title: "build_website",
      spec: { goal: "build my website" },
    });
    expect(result.taskId).toBe("task_existing");
    expect(result.result.ok).toBe(true);
    expect(result.result.summary).toMatch(/idempotency/i);
    // Crucially, we should NOT have called create() to make a new task.
    expect(dbMock.agentTask.create).not.toHaveBeenCalled();
  });

  it("creates a new task when no recent in-flight match exists", async () => {
    dbMock.agentTask.findFirst.mockResolvedValue(null);
    dbMock.agentTask.create.mockResolvedValue({ id: "task_new" });
    dbMock.agentTask.update.mockResolvedValue({});
    dbMock.activityEvent.create.mockResolvedValue({});
    const { runTask } = await import("@/lib/executor/router");
    const result = await runTask({
      businessId: "biz_1",
      userId: "user_1",
      title: "build_website",
      spec: { goal: "build my website" },
    });
    expect(result.taskId).toBe("task_new");
    expect(dbMock.agentTask.create).toHaveBeenCalled();
  });
});
