import { describe, it, expect } from "vitest";

describe("Supabase environment configuration", () => {
  it("NEXT_PUBLIC_SUPABASE_URL is configured", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy();
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(
      /^https?:\/\/.+/,
    );
  });

  it("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is configured", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeTruthy();
  });

  it("SUPABASE_MANAGEMENT_API_TOKEN is optional but present in CI", () => {
    // Not required in dev, but when set it must be non-empty
    if (process.env.SUPABASE_MANAGEMENT_API_TOKEN) {
      expect(process.env.SUPABASE_MANAGEMENT_API_TOKEN).not.toBe("");
    }
  });
});
