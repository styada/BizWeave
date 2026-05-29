import { describe, expect, it } from "vitest";
import {
  intakeSchema,
  parseWithSchema,
  safeguardSchema,
} from "@/lib/agents/contracts";
import { fallbackIntake, fallbackSafeguard } from "@/lib/agents/fallback";

describe("agent contracts", () => {
  it("parses valid intake payload", () => {
    const raw = JSON.stringify({
      persona: "Local customers",
      valueProps: ["Fast", "Friendly"],
      tone: "warm",
      competitorHints: ["selection"],
      constraints: [],
    });

    const result = parseWithSchema(raw, intakeSchema, fallbackIntake({
      id: "b1",
      name: "Demo",
      type: "retail-general",
      inventory: [],
    }));

    expect(result.usedFallback).toBe(false);
    expect(result.value.persona).toContain("Local");
  });

  it("falls back on invalid safeguard payload", () => {
    const fallback = fallbackSafeguard(false);
    const result = parseWithSchema("{ bad json", safeguardSchema, fallback);

    expect(result.usedFallback).toBe(true);
    expect(result.value.reliabilityIndex).toBeGreaterThanOrEqual(0);
    expect(result.value.reliabilityIndex).toBeLessThanOrEqual(100);
  });
});
