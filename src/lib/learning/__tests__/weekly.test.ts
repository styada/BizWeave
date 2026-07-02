import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  agentTask: { findMany: vi.fn() },
  activityEvent: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const scoreMock = vi.fn();
vi.mock("@/lib/learning/evaluate", () => ({
  scoreTaskOutcome: scoreMock,
}));

const promoteMock = vi.fn();
vi.mock("@/lib/learning/promote", () => ({
  promoteSkillsToLibrary: promoteMock,
}));

const dreamMock = vi.fn();
vi.mock("@/lib/dreaming/cycle", () => ({
  runDreamingCycle: dreamMock,
}));

describe("runWeeklyReflection (Phase I)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.agentTask.findMany.mockResolvedValue([]);
    dbMock.activityEvent.create.mockResolvedValue({});
    scoreMock.mockResolvedValue({ reward: 0.5, kpiDeltas: {} });
    promoteMock.mockResolvedValue({ proposed: 0, approved: 0 });
    dreamMock.mockResolvedValue({
      businessId: "biz_1",
      mood: "healthy",
      proposals: [],
      brief: "All quiet this week.",
    });
  });

  it("returns zero tasks scored when no recent completions", async () => {
    const { runWeeklyReflection } = await import("@/lib/learning/weekly");
    const r = await runWeeklyReflection("biz_1", "user_1");
    expect(r.tasksScored).toBe(0);
    expect(r.skillsPromoted).toBe(0);
    expect(r.dreamsRun).toBe(1);
    expect(r.briefExcerpt).toBe("All quiet this week.");
  });

  it("scores each recent done task and emits a weekly_reflection event", async () => {
    dbMock.agentTask.findMany.mockResolvedValue([
      { id: "t1", title: "build_website" },
      { id: "t2", title: "outreach" },
      { id: "t3", title: "competitor_intel" },
    ]);
    const { runWeeklyReflection } = await import("@/lib/learning/weekly");
    const r = await runWeeklyReflection("biz_1", "user_1");
    expect(r.tasksScored).toBe(3);
    expect(scoreMock).toHaveBeenCalledTimes(3);
    expect(dbMock.activityEvent.create).toHaveBeenCalledTimes(1);
    const call = dbMock.activityEvent.create.mock.calls[0][0];
    expect(call.data.eventType).toBe("weekly_reflection");
    expect(call.data.message).toContain("3 tasks scored");
  });

  it("propagates skill promotion count from promoteSkillsToLibrary", async () => {
    promoteMock.mockResolvedValue({ proposed: 2, approved: 0 });
    const { runWeeklyReflection } = await import("@/lib/learning/weekly");
    const r = await runWeeklyReflection("biz_1", "user_1");
    expect(r.skillsPromoted).toBe(2);
  });

  it("truncates brief to 240 chars in the excerpt", async () => {
    dreamMock.mockResolvedValue({
      businessId: "biz_1",
      mood: "healthy",
      proposals: [],
      brief: "a".repeat(500),
    });
    const { runWeeklyReflection } = await import("@/lib/learning/weekly");
    const r = await runWeeklyReflection("biz_1", "user_1");
    expect(r.briefExcerpt.length).toBe(240);
  });
});
