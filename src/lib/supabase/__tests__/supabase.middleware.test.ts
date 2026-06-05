import { describe, it, expect, beforeAll } from "vitest";

describe("Supabase middleware module", () => {
  let updateSession: typeof import("@/lib/supabase/middleware").updateSession;

  beforeAll(async () => {
    try {
      const mod = await import("@/lib/supabase/middleware");
      updateSession = mod.updateSession;
    } catch {
      // Module may fail to import if env vars are missing
    }
  });

  it("exports updateSession function", () => {
    expect(updateSession).toBeDefined();
    expect(typeof updateSession).toBe("function");
  });
});
