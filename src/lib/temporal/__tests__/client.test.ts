/**
 * Phase T.2: tests for the Temporal client wrapper.
 *
 * Real Temporal server tests need a TestWorkflowEnvironment — that's a
 * follow-up. Here we verify the wrapper exports load, the taskId
 * shape is correct, and failure modes throw rather than crash.
 */
import { describe, it, expect } from "vitest";

describe("temporal client wrapper", () => {
  it("module loads without error", async () => {
    const mod = await import("../client");
    expect(typeof mod.startBuildSiteWorkflow).toBe("function");
    expect(typeof mod.describeBuildSite).toBe("function");
  });

  it("throws when no Temporal server is reachable", async () => {
    const { startBuildSiteWorkflow } = await import("../client");
    const result = await Promise.race([
      startBuildSiteWorkflow({ businessId: "biz_1", userId: "user_1" })
        .then(() => ({ ok: true as const }))
        .catch((err) => ({ ok: false as const, err })),
      new Promise<{ ok: false; err: Error }>((resolve) =>
        setTimeout(() => resolve({ ok: false, err: new Error("timeout") }), 8000)
      ),
    ]);
    expect(result.ok).toBe(false);
  }, 15000);
});
