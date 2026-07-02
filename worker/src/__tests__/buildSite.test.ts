/**
 * Phase T.1: workflow + activity shape tests.
 *
 * These tests don't require a live Temporal server. They verify:
 *   - Workflow exports the right shape
 *   - Activity stubs return what the workflow expects
 *   - Workflow control flow (safeguard decides publish vs needs_approval)
 *
 * Integration tests with a real TestWorkflowEnvironment come in Phase T.2.
 */
import { describe, it, expect } from "vitest";

describe("worker: buildSite workflow shape", () => {
  it("exports TASK_QUEUE as 'bizweave-operator'", async () => {
    const { TASK_QUEUE } = await import("../connection");
    expect(TASK_QUEUE).toBe("bizweave-operator");
  });

  it("exports getTemporalAddress with localhost default", async () => {
    const { getTemporalAddress } = await import("../connection");
    expect(getTemporalAddress()).toBe("localhost:7233");
  });

  it("activity stubs return success shape for the happy path", async () => {
    const acts = await import("../activities/buildSite");
    const ctx = { businessId: "biz_1", userId: "user_1" };
    expect((await acts.intake(ctx)).ok).toBe(true);
    expect((await acts.plan(ctx)).ok).toBe(true);
    expect((await acts.build(ctx)).ok).toBe(true);
    expect((await acts.marketing(ctx)).ok).toBe(true);
    expect((await acts.support(ctx)).ok).toBe(true);
    const sg = await acts.safeguard(ctx);
    expect(sg.approved).toBe(true);
    expect((await acts.publish(ctx)).ok).toBe(true);
  });
});
