import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  $queryRaw: vi.fn(),
  generatedSite: { findUnique: vi.fn() },
  deployment: { findFirst: vi.fn() },
  phoneAgent: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("verifyCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects website tasks without persisted HTML", async () => {
    dbMock.generatedSite.findUnique.mockResolvedValue({ html: "<p>hi</p>" });

    const { verifyCompletion } = await import("@/lib/executor/verify");
    const result = await verifyCompletion({
      businessId: "biz_1",
      goal: "build a website",
      result: { ok: true, summary: "done", costUsd: 1 },
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("no_site_html_persisted");
  });

  it("verifies website when enough HTML exists", async () => {
    dbMock.generatedSite.findUnique.mockResolvedValue({
      html: "<section>" + "x".repeat(300) + "</section>",
    });

    const { verifyCompletion } = await import("@/lib/executor/verify");
    const result = await verifyCompletion({
      businessId: "biz_1",
      goal: "build website",
      result: { ok: true, summary: "Site built", costUsd: 1 },
    });
    expect(result.verified).toBe(true);
  });

  it("verifies live deployment goals", async () => {
    dbMock.deployment.findFirst.mockResolvedValue({ id: "dep_1" });

    const { verifyCompletion } = await import("@/lib/executor/verify");
    const result = await verifyCompletion({
      businessId: "biz_1",
      goal: "publish and go live",
      result: { ok: true, summary: "Published", costUsd: 0 },
    });
    expect(result.verified).toBe(true);
  });
});
