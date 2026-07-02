/**
 * Tests for env feature flags.
 *
 * Because flags is computed at module-load time, each test must
 * reset the module cache after mutating process.env. We use
 * vi.resetModules() to force a fresh import.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalTemporal = process.env.FEATURE_TEMPORAL;

beforeEach(() => {
  delete process.env.FEATURE_TEMPORAL;
  vi.resetModules();
});

afterEach(() => {
  if (originalTemporal === undefined) delete process.env.FEATURE_TEMPORAL;
  else process.env.FEATURE_TEMPORAL = originalTemporal;
  vi.resetModules();
});

async function loadFlags() {
  const mod = await import("@/lib/env");
  return mod.flags;
}

describe("flags.temporal", () => {
  it("defaults to false", async () => {
    const flags = await loadFlags();
    expect(flags.temporal).toBe(false);
  });

  it("is true when FEATURE_TEMPORAL=1", async () => {
    process.env.FEATURE_TEMPORAL = "1";
    const flags = await loadFlags();
    expect(flags.temporal).toBe(true);
  });

  it("is true when FEATURE_TEMPORAL=true", async () => {
    process.env.FEATURE_TEMPORAL = "true";
    const flags = await loadFlags();
    expect(flags.temporal).toBe(true);
  });
});
