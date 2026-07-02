import { describe, it, expect } from "vitest";
import { buildTemplateSite, slugFromName } from "@/lib/sites/templates";
import type { BusinessContext } from "@/lib/agents/types";

const ctx: BusinessContext = {
  id: "b1",
  name: "Joe's Coffee",
  type: "cafe",
  tagline: "Best beans in town",
  description: "A cozy neighborhood cafe.",
  location: "123 Main St",
  phone: "555-0100",
  email: "joe@coffee.test",
  inventory: [{ name: "Latte", price: 4.5, category: "drinks" }],
};

describe("buildTemplateSite", () => {
  it("includes backlink footer by default", () => {
    const site = buildTemplateSite(ctx, "classic");
    expect(site.html).toContain("Website by Bizweave");
    expect(site.html).toContain('rel="dofollow"');
  });

  it("can omit backlink", () => {
    const site = buildTemplateSite(ctx, "minimal", { includeBacklink: false });
    expect(site.html).not.toContain("Website by Bizweave");
  });
});

describe("slugFromName", () => {
  it("slugifies business names", () => {
    expect(slugFromName("Joe's Coffee & Tea!")).toBe("joe-s-coffee-tea");
  });
});
