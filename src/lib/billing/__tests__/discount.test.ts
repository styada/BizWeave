import { describe, it, expect } from "vitest";
import { priceForBusinessAt, TIER_PRICE_USD } from "@/lib/billing/entitlements";

describe("multi-business discount", () => {
  it("first business pays list price", () => {
    expect(priceForBusinessAt("operator1500", 0)).toBe(TIER_PRICE_USD.operator1500);
  });

  it("applies $250 discount per additional business", () => {
    expect(priceForBusinessAt("operator1500", 1)).toBe(1250);
    expect(priceForBusinessAt("operator1500", 2)).toBe(1000);
  });

  it("floors at $1000/mo per business", () => {
    expect(priceForBusinessAt("operator1500", 5)).toBe(1000);
  });
});
