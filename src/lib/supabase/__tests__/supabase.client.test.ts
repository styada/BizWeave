import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// These tests are integration tests that require a real Supabase project.
// They are skipped when env vars are not configured.
const itWhenConfigured = (supabaseUrl && supabaseKey ? it : it.skip);

describe("Supabase client connectivity", () => {
  const supabase = createClient(
    supabaseUrl ?? "https://placeholder.supabase.co",
    supabaseKey ?? "placeholder-key",
  );

  itWhenConfigured("can connect and fetch auth health", async () => {
    // Verify the Supabase API is reachable by checking session (no session expected)
    const { data, error } = await supabase.auth.getSession();
    // Expect no error — the server responded even if no session exists
    expect(error).toBeNull();
    expect(data).toHaveProperty("session");
    expect(data.session).toBeNull(); // No active session in test context
  });

  itWhenConfigured("can introspect project ref from URL", () => {
    // Validate that the URL looks like a real Supabase project
    const match = supabaseUrl?.match(/^https?:\/\/([^.]+)\.supabase\.co/);
    expect(match).not.toBeNull();
    expect(match![1]).toBeTruthy();
    // Project refs are typically 20 alphanumeric characters
    expect(match![1].length).toBeGreaterThanOrEqual(20);
  });

  itWhenConfigured("publishable key has expected format", () => {
    // Supabase publishable keys start with sb_publishable_
    expect(supabaseKey).toMatch(/^sb_publishable_/);
  });
});
