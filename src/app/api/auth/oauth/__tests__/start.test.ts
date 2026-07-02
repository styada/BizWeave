/**
 * Tests for the OAuth start route's input validation.
 *
 * The actual signInWithOAuth call requires a real Supabase project.
 * We mock the Supabase client and verify the route:
 *   - rejects unknown providers with 400
 *   - rejects missing providers with 400
 *   - rejects open-redirect attempts in the redirect param
 *   - accepts known providers and returns 307 to the Supabase URL
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithOAuth: exchangeMock,
    },
  }),
}));

// Import after mocking
const { GET } = await import("../start/route");

describe("OAuth start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unknown provider with 400", async () => {
    const res = await GET(
      new Request("http://localhost/api/auth/oauth/start?provider=facebook")
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unknown provider/i);
  });

  it("rejects missing provider with 400", async () => {
    const res = await GET(new Request("http://localhost/api/auth/oauth/start"));
    expect(res.status).toBe(400);
  });

  it("rejects open-redirect attempts", async () => {
    exchangeMock.mockResolvedValue({
      data: { url: "https://supabase.example/auth" },
      error: null,
    });
    // Attempt to redirect off-site.
    const res = await GET(
      new Request(
        "http://localhost/api/auth/oauth/start?provider=google&redirect=//evil.example.com/path"
      )
    );
    // The route strips the bad redirect before passing to Supabase,
    // but the route itself should still succeed.
    expect(res.status).toBe(307);
    // Verify Supabase was called with a sanitized callback URL.
    const callArgs = exchangeMock.mock.calls[0][0];
    expect(callArgs.options.redirectTo).not.toContain("evil.example.com");
  });

  it("accepts valid provider and returns 307 to Supabase URL", async () => {
    exchangeMock.mockResolvedValue({
      data: { url: "https://supabase.example/auth" },
      error: null,
    });
    const res = await GET(
      new Request("http://localhost/api/auth/oauth/start?provider=google")
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://supabase.example/auth");
  });

  it("returns 500 when Supabase errors", async () => {
    exchangeMock.mockResolvedValue({
      data: { url: null },
      error: { message: "provider disabled" },
    });
    const res = await GET(
      new Request("http://localhost/api/auth/oauth/start?provider=google")
    );
    expect(res.status).toBe(500);
  });
});
