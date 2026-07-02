import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock global fetch so we don't actually hit the network.
const fetchMock = vi.fn();

describe("listModels", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty array when the apiKey is empty (no fetch)", async () => {
    const { listModels } = await import("../client");
    const result = await listModels("openai", "");
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an empty array when the provider is unknown", async () => {
    const { listModels } = await import("../client");
    const result = await listModels("nope", "sk-x");
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses an OpenAI-style /v1/models response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        object: "list",
        data: [
          { id: "gpt-4o", owned_by: "openai" },
          { id: "gpt-4o-mini", owned_by: "openai" },
          { id: "o1", owned_by: "openai" },
        ],
      }),
    });
    const { listModels } = await import("../client");
    const result = await listModels("openai", "sk-test");
    expect(result.map((m) => m.id)).toEqual([
      "gpt-4o",
      "gpt-4o-mini",
      "o1",
    ]);
    expect(result[0].ownedBy).toBe("openai");
  });

  it("parses an Anthropic-style /v1/models response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "claude-3-5-haiku-20241022", display_name: "Claude 3.5 Haiku" },
          { id: "claude-3-5-sonnet-20241022", display_name: "Claude 3.5 Sonnet" },
        ],
      }),
    });
    const { listModels } = await import("../client");
    const result = await listModels("anthropic", "sk-ant-test");
    expect(result.map((m) => m.id)).toEqual([
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20241022",
    ]);
    expect(result[0].ownedBy).toBe("Claude 3.5 Haiku");
  });

  it("parses an Ollama-style /v1/models response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: "llama3.1:8b", details: { family: "llama" } },
          { name: "qwen2.5-coder:32b" },
        ],
      }),
    });
    const { listModels } = await import("../client");
    const result = await listModels(
      "custom-openai",
      "ignored",
      "http://localhost:11434/v1/chat/completions"
    );
    expect(result.map((m) => m.id)).toEqual([
      "llama3.1:8b",
      "qwen2.5-coder:32b",
    ]);
    expect(result[0].ownedBy).toBe("llama");
  });

  it("returns an empty array on a non-2xx response (never throws)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });
    const { listModels } = await import("../client");
    const result = await listModels("openai", "sk-bad");
    expect(result).toEqual([]);
  });

  it("returns an empty array on a network error (never throws)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("DNS failure"));
    const { listModels } = await import("../client");
    const result = await listModels("openai", "sk-test");
    expect(result).toEqual([]);
  });

  it("returns an empty array when the response is empty", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const { listModels } = await import("../client");
    const result = await listModels("openai", "sk-test");
    expect(result).toEqual([]);
  });

  it("requires a baseUrl for custom-openai", async () => {
    const { listModels } = await import("../client");
    const result = await listModels("custom-openai", "sk-test");
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
