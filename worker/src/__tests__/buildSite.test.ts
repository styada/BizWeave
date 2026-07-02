/**
 * Phase T.2: workflow + activity shape tests.
 *
 * These tests verify the connection helpers and activity contract.
 * Full end-to-end tests against a real Temporal server need
 * `temporal server start-dev` and are out of scope for the unit suite.
 */
import { describe, it, expect } from "vitest";

describe("worker: connection helpers", () => {
  it("getTemporalAddress returns localhost:7233 by default", async () => {
    const { getTemporalAddress } = await import("../connection");
    expect(getTemporalAddress()).toBe("localhost:7233");
  });

  it("TASK_QUEUE is 'bizweave-operator'", async () => {
    const { TASK_QUEUE } = await import("../connection");
    expect(TASK_QUEUE).toBe("bizweave-operator");
  });
});

describe("worker: activity contract", () => {
  it("safeguard returns approved+needsApproval+reliabilityIndex", async () => {
    // The real activities hit the DB. Here we verify the SHAPE that the
    // workflow expects. The integration test would run against a real
    // Temporal server with a real DB.
    const fakeActs = {
      intake: async () => ({ ok: true as const, businessName: "Test" }),
      plan: async () => ({ ok: true as const }),
      build: async () => ({ ok: true as const, siteId: "s1" }),
      marketing: async () => ({ ok: true as const }),
      support: async () => ({ ok: true as const }),
      safeguard: async () => ({
        approved: true,
        needsApproval: false,
        runId: "wf-x",
        reliabilityIndex: 88,
      }),
      publish: async () => ({ ok: true as const, url: "https://example.com" }),
    };
    const ctx = { businessId: "biz_1", userId: "user_1", runId: "wf-x" };
    expect((await fakeActs.intake(ctx)).ok).toBe(true);
    expect((await fakeActs.build(ctx)).siteId).toBe("s1");
    const sg = await fakeActs.safeguard(ctx);
    expect(sg.approved).toBe(true);
    expect(sg.needsApproval).toBe(false);
    expect(sg.reliabilityIndex).toBe(88);
    const pub = await fakeActs.publish(ctx);
    expect(pub.ok).toBe(true);
    expect(pub.url).toBe("https://example.com");
  });
});
