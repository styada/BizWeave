import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const guardMock = vi.fn();
vi.mock("@/lib/guard/guard", () => ({
  guardAction: guardMock,
}));

const dbMock = {
  business: { findUnique: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("MCP registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.business.findUnique.mockResolvedValue({ workspaceId: null });
    guardMock.mockResolvedValue({ status: "executed", result: { ok: true } });
  });

  it("runs read-only tools without guard", async () => {
    const { McpRegistry } = await import("@/lib/mcp/registry");
    const reg = new McpRegistry();
    reg.register({
      name: "test.read",
      description: "read only",
      sideEffect: false,
      inputSchema: z.object({}),
      run: async () => ({ items: [1, 2] }),
    });

    const result = await reg.invoke("test.read", {}, { businessId: "b1", userId: "u1" });
    expect(result.status).toBe("ok");
    expect(guardMock).not.toHaveBeenCalled();
  });

  it("routes side-effecting tools through guardAction", async () => {
    const { McpRegistry } = await import("@/lib/mcp/registry");
    const reg = new McpRegistry();
    reg.register({
      name: "test.write",
      description: "write",
      sideEffect: true,
      riskLevel: "medium",
      actionType: "test.write",
      inputSchema: z.object({}),
      run: async () => ({ sent: true }),
    });

    const result = await reg.invoke("test.write", { x: 1 }, { businessId: "b1", userId: "u1" });
    expect(guardMock).toHaveBeenCalled();
    expect(result.status).toBe("ok");
  });
});
