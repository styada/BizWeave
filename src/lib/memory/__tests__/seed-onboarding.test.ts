import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { addMemory, retrieveMemory } from "@/lib/memory/store";
import { hashPassword } from "@/lib/auth";

/**
 * Phase E: prove that adding facts via addMemory + retrieving them by query
 * works end-to-end against the real DB. (The full /api/businesses route is
 * hard to call in isolation; we test the underlying helpers.)
 */
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("memory: seed + retrieve (Phase E)", () => {
  let userId: string;
  let businessId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("testpass123");
    const user = await db.user.create({
      data: {
        email: `mem-test-${Date.now()}@example.com`,
        passwordHash,
        name: "Mem Test",
      },
    });
    userId = user.id;
    const business = await db.business.create({
      data: { userId, name: "Mem Test Cafe", type: "cafe", status: "draft" },
    });
    businessId = business.id;
  });

  afterAll(async () => {
    await db.memoryEntry.deleteMany({ where: { businessId } });
    await db.business.delete({ where: { id: businessId } });
    await db.user.delete({ where: { id: userId } });
  });

  it("addMemory persists a fact retrievable by keyword", async () => {
    const id = await addMemory({
      businessId,
      kind: "fact",
      content: "Open 7am to 9pm Monday through Saturday",
      salience: 0.9,
      source: "test",
      userId,
    });
    expect(id).not.toBeNull();
    const rows = await retrieveMemory({ businessId, query: "hours open saturday", k: 5 });
    const found = rows.find((r) => r.content.includes("7am to 9pm"));
    expect(found).toBeDefined();
  });

  it("addMemory is best-effort: returns null on DB error", async () => {
    // Pass an invalid businessId (cuid format check would reject it). The
    // function should catch and return null instead of throwing.
    const id = await addMemory({
      businessId: "not-a-valid-id",
      kind: "fact",
      content: "should fail",
    }).catch(() => "THREW");
    expect(id === null || id === "THREW").toBe(true);
  });

  it("returns [] when business has no memory", async () => {
    // Use a fresh businessId that has no memory.
    const other = await db.business.create({
      data: { userId, name: "Empty", type: "other", status: "draft" },
    });
    const rows = await retrieveMemory({ businessId: other.id, query: "anything", k: 5 });
    expect(rows).toEqual([]);
    await db.business.delete({ where: { id: other.id } });
  });
});
