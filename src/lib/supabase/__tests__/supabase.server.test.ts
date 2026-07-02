import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  })),
}));

describe("Supabase server client module", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
  });

  it("exports a createClient function", async () => {
    const mod = await import("@/lib/supabase/server");
    expect(typeof mod.createClient).toBe("function");
  });

  it("createClient returns an object with auth property", async () => {
    const mod = await import("@/lib/supabase/server");
    const client = await mod.createClient();
    expect(client.auth).toBeDefined();
    expect(typeof client.auth.getSession).toBe("function");
  });
});
