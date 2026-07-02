/**
 * Integration tests for the Supabase OAuth user-provisioning helper.
 * Uses a real Postgres (skipped if DATABASE_URL unset).
 */
import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { provisionUserFromSupabase } from "@/lib/supabase/provision";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("provisionUserFromSupabase", () => {
  // supabaseAuthId is a @db.Uuid column, so we must use a real UUID.
  const supabaseId = randomUUID();
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const linkedEmail = `linked-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
    await db.user.deleteMany({ where: { email: linkedEmail } });
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
    const before = await db.user.create({
      data: {
        email: linkedEmail,
        passwordHash: "x",
        name: "Original Name",
      },
    });
    expect(before.supabaseAuthId).toBeNull();

    const newSbId = randomUUID();
    const user = await provisionUserFromSupabase({
      supabaseId: newSbId,
      email: before.email,
      fullName: "Updated Name",
    });

    expect(user.id).toBe(before.id);
    const after = await db.user.findUnique({ where: { id: before.id } });
    expect(after?.supabaseAuthId).toBe(newSbId);
    expect(after?.name).toBe("Original Name");
  });
});
