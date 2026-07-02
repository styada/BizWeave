import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the DB + crypto modules so resolveLlm can be tested in isolation.
vi.mock("@/lib/db", () => ({
  db: {
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(),
}));

import { resolveLlm } from "@/lib/llm/resolve";

describe("resolveLlm", () => {
  const originalOpenai = process.env.OPENAI_API_KEY;
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalOpenai !== undefined) process.env.OPENAI_API_KEY = originalOpenai;
    if (originalAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = originalAnthropic;
  });

  it("returns null when no BYOK and no env keys", async () => {
    const result = await resolveLlm("user-no-keys");
    expect(result).toBeNull();
  });

  it("returns null when env key is empty string (the hang bug)", async () => {
    process.env.OPENAI_API_KEY = "";
    const result = await resolveLlm("user-empty-env");
    expect(result).toBeNull();
  });

  it("returns managed key when env key is set and non-empty", async () => {
    process.env.OPENAI_API_KEY = "sk-real-key";
    const result = await resolveLlm("user-env-set");
    expect(result).toEqual({
      provider: "openai",
      apiKey: "sk-real-key",
      model: null,
      baseUrl: null,
      managed: true,
      def: expect.objectContaining({ id: "openai", kind: "openai" }),
    });
  });

  it("prefers Anthropic when only Anthropic is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-real";
    const result = await resolveLlm("user-anthropic-only");
    expect(result?.provider).toBe("anthropic");
    expect(result?.managed).toBe(true);
  });
});
