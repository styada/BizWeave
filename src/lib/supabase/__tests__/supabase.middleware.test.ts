import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  })),
}));

describe("Supabase middleware module", () => {
  it("exports updateSession function", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";

    const { updateSession } = await import("@/lib/supabase/middleware");
    expect(typeof updateSession).toBe("function");
  });
});
