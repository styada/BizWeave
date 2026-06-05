import { describe, it, expect, beforeAll } from "vitest";
import type { Database } from "@/generated/prisma";

// Server-side module tests — these test that the server client module
// can be imported and returns a factory with the expected shape.

describe("Supabase server client module", () => {
  let createClientModule: typeof import("@/lib/supabase/server");

  beforeAll(async () => {
    // Dynamic import to avoid build failures when env vars are missing
    try {
      createClientModule = await import("@/lib/supabase/server");
    } catch {
      // Module may fail to import if env vars are missing — that's ok for CI
    }
  });

  it("exports a createClient function", () => {
    expect(createClientModule).toBeDefined();
    expect(typeof createClientModule.createClient).toBe("function");
  });

  it("createClient returns an object with auth property", async () => {
    const client = await createClientModule.createClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    // Should have standard auth methods
    expect(typeof client.auth.getSession).toBe("function");
    expect(typeof client.auth.getUser).toBe("function");
    expect(typeof client.auth.signInWithPassword).toBe("function");
  });
});
