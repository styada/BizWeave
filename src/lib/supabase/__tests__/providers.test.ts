import { describe, it, expect } from "vitest";
import {
  OAUTH_PROVIDERS,
  isOAuthProvider,
  getProvider,
} from "@/lib/supabase/providers";

describe("OAuth provider list", () => {
  it("includes Google, Apple, GitHub", () => {
    const ids = OAUTH_PROVIDERS.map((p) => p.id);
    expect(ids).toContain("google");
    expect(ids).toContain("apple");
    expect(ids).toContain("github");
  });

  it("every provider has a slug matching its id", () => {
    for (const p of OAUTH_PROVIDERS) {
      expect(p.slug).toBe(p.id);
    }
  });

  it("isOAuthProvider accepts known slugs and rejects unknown", () => {
    expect(isOAuthProvider("google")).toBe(true);
    expect(isOAuthProvider("apple")).toBe(true);
    expect(isOAuthProvider("github")).toBe(true);
    expect(isOAuthProvider("facebook")).toBe(false);
    expect(isOAuthProvider("evil")).toBe(false);
    expect(isOAuthProvider("")).toBe(false);
  });

  it("getProvider returns the matching record or undefined", () => {
    expect(getProvider("google")?.label).toBe("Google");
    expect(getProvider("apple")?.label).toBe("Apple");
    expect(getProvider("github")?.label).toBe("GitHub");
    expect(getProvider("not-a-provider")).toBeUndefined();
  });

  it("every provider has a description and ringClass", () => {
    for (const p of OAUTH_PROVIDERS) {
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.ringClass).toMatch(/^ring-/);
    }
  });
});
