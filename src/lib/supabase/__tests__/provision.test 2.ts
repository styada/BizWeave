/**
 * Integration tests for the Supabase OAuth user-provisioning helper.
 * Uses a real Postgres (skipped if DATABASE_URL unset).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { provisionUserFromSupabase } from "@/lib/supabase/provision";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("provisionUserFromSupabase", () => {
  const uniqueId = `test-supabase-${Date.now()}-${Math.random()}`;
  const supabaseId = `${uniqueId}-sb`;
  const email = `${uniqueId}@example.com`;

  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
  });

  it("(c) creates a new user when no match exists", async () => {
    const user = await provisionUserFromSupabase({
      supabaseId,
      email,
      fullName: "Test User",
    });
    expect(user.email).toBe(email);
    expect(user.name).toBe("Test User");
    const row = await db.user.findUnique({ where: { email } });
    expect(row?.supabaseAuthId).toBe(supabaseId);
    // Password is required NOT NULL in schema; verify a hash was set.
    expect(row?.passwordHash.length).toBeGreaterThan(20);
  });

  it("(a) returns the existing linked user on second call", async () => {
    const user = await provisionUserFromSupabase({
      supabaseId,
      email,
      fullName: "Test User",
    });
    expect(user.email).toBe(email);
  });

  it("(b) links an existing email-only user to a new supabase id", async () => {
    // Create an email-only user (no supabaseAuthId).
    const before = await db.user.create({
      data: {
        email: `linked-${uniqueId}@example.com`,
        passwordHash: "x",
        name: "Original Name",
      },
    });
    expect(before.supabaseAuthId).toBeNull();

    // Now provision with the same email but a different supabase id.
    const newSbId = `${uniqueId}-linked`;
    const user = await provisionUserFromSupabase({
      supabaseId: newSbId,
      email: before.email,
      fullName: "Updated Name",
    });

    expect(user.id).toBe(before.id);
    const after = await db.user.findUnique({ where: { id: before.id } });
    expect(after?.supabaseAuthId).toBe(newSbId);
    expect(after?.name).toBe("Original Name"); // existing name preserved

    await db.user.delete({ where: { id: before.id } });
  });
});
