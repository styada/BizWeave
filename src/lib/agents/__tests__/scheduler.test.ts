import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  taskExecution: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  activityEvent: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

const runAgentPipelineMock = vi.fn();
vi.mock("@/lib/agents/orchestrator", () => ({
  runAgentPipeline: runAgentPipelineMock,
}));

function queuedExecution(overrides?: {
  retryCount?: number;
  maxAttempts?: number;
}) {
  return {
    id: "exec_1",
    retryCount: overrides?.retryCount ?? 0,
    maxAttempts: overrides?.maxAttempts ?? 3,
    scheduledTask: {
      businessId: "biz_1",
      agent: "orchestrator",
      business: {
        id: "biz_1",
        userId: "user_1",
      },
    },
  };
}

describe("scheduler retry and dead-letter behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.taskExecution.update.mockResolvedValue({});
    dbMock.activityEvent.create.mockResolvedValue({});
  });

  it("schedules retry when attempts remain", async () => {
    dbMock.taskExecution.findMany.mockResolvedValue([queuedExecution({ retryCount: 0, maxAttempts: 3 })]);
    runAgentPipelineMock.mockRejectedValue(new Error("transient failure"));

    const { processQueuedExecutions } = await import("@/lib/scheduler");
    const result = await processQueuedExecutions(5);

    expect(result.failed).toBe(1);
    expect(result.retried).toBe(1);
    expect(result.deadLettered).toBe(0);

    expect(dbMock.taskExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec_1" },
        data: expect.objectContaining({
          status: "queued",
          retryCount: 1,
        }),
      })
    );
  });

  it("moves execution to dead letter when max attempts reached", async () => {
    dbMock.taskExecution.findMany.mockResolvedValue([queuedExecution({ retryCount: 2, maxAttempts: 3 })]);
    runAgentPipelineMock.mockRejectedValue(new Error("persistent failure"));

    const { processQueuedExecutions } = await import("@/lib/scheduler");
    const result = await processQueuedExecutions(5);

    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);
    expect(result.deadLettered).toBe(1);

    expect(dbMock.taskExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec_1" },
        data: expect.objectContaining({
          status: "dead_letter",
          retryCount: 3,
        }),
      })
    );
  });

  it("marks execution completed when pipeline succeeds", async () => {
    dbMock.taskExecution.findMany.mockResolvedValue([queuedExecution()]);
    runAgentPipelineMock.mockResolvedValue({ runId: "run_1" });

    const { processQueuedExecutions } = await import("@/lib/scheduler");
    const result = await processQueuedExecutions(5);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);

    expect(dbMock.taskExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec_1" },
        data: expect.objectContaining({
          status: "completed",
          run: { connect: { id: "run_1" } },
        }),
      })
    );
  });
});
