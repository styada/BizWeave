import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  $queryRaw: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const flagsMock = { langgraph: false, deepExecutor: false, dreaming: false, backlinkFreeTier: true };
vi.mock("@/lib/env", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/env")>();
  return { ...orig, flags: flagsMock, hasOpenAiKey: () => false, hasAnthropicKey: () => false };
});

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("returns ok when database is reachable", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.db).toBe(true);
    expect(body.flags).toBeDefined();
  });

  it("returns degraded when database fails", async () => {
    dbMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
  });
});
