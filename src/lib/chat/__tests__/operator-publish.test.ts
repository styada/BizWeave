import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { publishSite, classifyIntent } from "@/lib/chat/operator";

/**
 * End-to-end test for Phase B: build a site, publish it, verify the row flips
 * to "published" and is reachable via the public route. Uses a real Postgres
 * connection (HOME env DATABASE_URL), so skip in CI without a DB.
 */
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("publishSite end-to-end", () => {
  let userId: string;
  let businessId: string;
  let siteId: string;

  beforeAll(async () => {
    // Create a one-off test user + business + draft site.
    const passwordHash = await hashPassword("testpass123");
    const user = await db.user.create({
      data: {
        email: `publish-test-${Date.now()}@example.com`,
        passwordHash,
        name: "Publish Test",
      },
    });
    userId = user.id;
    const business = await db.business.create({
      data: {
        userId,
        name: "Publish Test Cafe",
        type: "cafe",
        tagline: "Test tagline",
        description: "Test description",
        status: "draft",
      },
    });
    businessId = business.id;
    const site = await db.generatedSite.create({
      data: {
        businessId,
        html: "<h1>Test</h1>",
        css: "body { color: red; }",
        meta: JSON.stringify({ title: "Test", description: "Test site" }),
        status: "draft",
      },
    });
    siteId = site.id;
  });

  afterAll(async () => {
    // Clean up. Order matters: child tables first.
    await db.generatedSite.deleteMany({ where: { businessId } });
    await db.business.deleteMany({ where: { id: businessId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  it("classifies 'publish my site' as publish_site intent", () => {
    expect(classifyIntent("publish my site")).toBe("publish_site");
    expect(classifyIntent("ship it")).toBe("publish_site");
    expect(classifyIntent("take it live")).toBe("publish_site");
    expect(classifyIntent("launch")).toBe("publish_site");
  });

  it("classifies 'how do I publish' as a publish action (keyword wins over question)", () => {
    // The 'publish' keyword is more specific than the generic 'how' prefix,
    // so the user clearly wants to publish, not to be told how.
    expect(classifyIntent("how do I publish my site?")).toBe("publish_site");
  });

  it("publishSite returns ok with URL when site exists", async () => {
    const result = await publishSite(businessId, userId);
    expect(result.ok).toBe(true);
    expect(result.url).toContain(`/sites/${businessId}`);
    expect(result.message).toMatch(/live/i);
  });

  it("flips GeneratedSite.status to 'published' in the DB", async () => {
    const after = await db.generatedSite.findUnique({ where: { businessId } });
    expect(after?.status).toBe("published");
    expect(after?.id).toBe(siteId);
  });

  it("records a site.published ActivityEvent", async () => {
    const events = await db.activityEvent.findMany({
      where: { businessId, eventType: "site.published" },
    });
    expect(events.length).toBe(1);
    expect(events[0].level).toBe("info");
  });

  it("publishSite returns helpful error when no site exists", async () => {
    // New business with no site.
    const other = await db.business.create({
      data: {
        userId,
        name: "No Site Business",
        type: "other",
        status: "draft",
      },
    });
    const result = await publishSite(other.id, userId);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/build it first/i);
    await db.business.delete({ where: { id: other.id } });
  });
});
