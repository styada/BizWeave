import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock db
const mockFindMany = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    activityEvent: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { GET } from "@/app/api/activity/route";
import { NextRequest } from "next/server";

function makeRequest(url = "http://localhost:3000/api/activity") {
  return new NextRequest(url);
}

describe("GET /api/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns events for authenticated user", async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: "user-1",
      email: "test@test.com",
      id: "user-1",
      name: "Test",
    } as never);

    mockFindMany.mockResolvedValue([
      {
        id: "evt-1",
        eventType: "run.completed",
        agent: "intake",
        level: "info",
        message: "Intake completed",
        createdAt: new Date(),
        business: { name: "My Business" },
      },
    ]);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].eventType).toBe("run.completed");
    expect(body.events[0].businessName).toBe("My Business");
  });

  it("filters by businessId", async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: "user-1",
      email: "test@test.com",
      id: "user-1",
      name: "Test",
    } as never);

    mockFindMany.mockResolvedValue([]);

    const url = "http://localhost:3000/api/activity?businessId=biz-1";
    await GET(makeRequest(url));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: "biz-1" }),
      })
    );
  });

  it("handles database errors gracefully", async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: "user-1",
      email: "test@test.com",
      id: "user-1",
      name: "Test",
    } as never);

    mockFindMany.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events).toEqual([]);
  });
});
