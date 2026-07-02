import { describe, it, expect } from "vitest";
import {
  PROVIDERS,
  getProvider,
  resolveChatUrl,
  resolveModelsUrl,
} from "../providers";

describe("LLM provider registry", () => {
  it("includes OpenAI, Anthropic, OpenCode Go, OpenCode Zen, and a custom option", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toContain("openai");
    expect(ids).toContain("anthropic");
    expect(ids).toContain("opencode-go");
    expect(ids).toContain("opencode-zen");
    expect(ids).toContain("custom-openai");
  });

  it("every provider has a kind and at least one model; built-ins have a baseUrl", () => {
    for (const p of PROVIDERS) {
      expect(["openai", "anthropic"]).toContain(p.kind);
      if (!p.customBaseUrl) {
        expect(p.baseUrl).toMatch(/^https?:\/\//);
      }
      if (p.models.length > 0) {
        expect(p.models).toContain(p.defaultModel);
      }
      if (!p.customBaseUrl) {
        expect(p.docs).toMatch(/^https?:\/\//);
      }
    }
  });

  it("getProvider returns the matching def or undefined", () => {
    expect(getProvider("openai")?.id).toBe("openai");
    expect(getProvider("opencode-go")?.kind).toBe("openai");
    expect(getProvider("opencode-zen")?.kind).toBe("openai");
    expect(getProvider("anthropic")?.kind).toBe("anthropic");
    expect(getProvider("nope")).toBeUndefined();
  });

  it("custom-openai has customBaseUrl=true and no default model on the registry", () => {
    const c = getProvider("custom-openai");
    expect(c?.customBaseUrl).toBe(true);
    // Custom doesn't prefill a baseUrl — it lives on the user's record.
    expect(c?.baseUrl).toBe("");
  });

  it("resolveChatUrl uses the registry baseUrl by default", () => {
    const def = getProvider("openai")!;
    expect(resolveChatUrl(def)).toBe(def.baseUrl);
  });

  it("resolveChatUrl appends /v1/chat/completions when baseUrl is bare", () => {
    // Custom providers leave baseUrl empty; the resolver normalizes.
    const def = { ...getProvider("custom-openai")! };
    def.baseUrl = "";
    expect(resolveChatUrl(def, "https://my-host.example.com")).toBe(
      "https://my-host.example.com/v1/chat/completions"
    );
  });

  it("resolveChatUrl trims trailing slashes and uses the override as-is when it already ends with /chat/completions", () => {
    const def = getProvider("custom-openai")!;
    expect(
      resolveChatUrl(def, "https://my-host.example.com/chat/completions")
    ).toBe("https://my-host.example.com/chat/completions");
    expect(
      resolveChatUrl(def, "https://my-host.example.com/chat/completions/")
    ).toBe("https://my-host.example.com/chat/completions");
  });

  it("OpenCode providers use the same chat-completions shape as OpenAI", () => {
    for (const id of ["openai", "opencode-go", "opencode-zen"]) {
      const p = getProvider(id);
      expect(p?.kind).toBe("openai");
      expect(p?.baseUrl).toMatch(/\/chat\/completions$/);
    }
  });
});

describe("resolveModelsUrl", () => {
  it("derives the OpenAI /v1/models from the chat-completions baseUrl", () => {
    const def = getProvider("openai")!;
    expect(resolveModelsUrl(def)).toBe("https://api.openai.com/v1/models");
  });

  it("derives the Anthropic /v1/models from the messages baseUrl", () => {
    const def = getProvider("anthropic")!;
    expect(resolveModelsUrl(def)).toBe(
      "https://api.anthropic.com/v1/models"
    );
  });

  it("derives OpenCode Go + Zen models URLs from their OpenAI-compatible baseUrls", () => {
    expect(resolveModelsUrl(getProvider("opencode-go")!)).toBe(
      "https://go.opencode.ai/v1/models"
    );
    expect(resolveModelsUrl(getProvider("opencode-zen")!)).toBe(
      "https://zen.opencode.ai/v1/models"
    );
  });

  it("normalizes a bare custom base URL to /v1/models", () => {
    const def = getProvider("custom-openai")!;
    expect(resolveModelsUrl(def, "https://my-host.example.com")).toBe(
      "https://my-host.example.com/v1/models"
    );
  });

  it("normalizes a custom base URL pointing at chat/completions", () => {
    const def = getProvider("custom-openai")!;
    expect(
      resolveModelsUrl(def, "https://my-host.example.com/v1/chat/completions")
    ).toBe("https://my-host.example.com/v1/models");
  });

  it("normalizes a custom base URL with trailing slashes", () => {
    const def = getProvider("custom-openai")!;
    expect(
      resolveModelsUrl(def, "https://my-host.example.com/v1/chat/completions/")
    ).toBe("https://my-host.example.com/v1/models");
  });

  it("throws when a custom provider is queried without a baseUrl", () => {
    const def = getProvider("custom-openai")!;
    expect(() => resolveModelsUrl(def)).toThrow(/base URL/);
  });
});
