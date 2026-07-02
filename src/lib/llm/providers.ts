/**
 * Phase K.1: LLM provider registry.
 *
 * OpenAI-compatible endpoints (OpenAI, OpenCode Go, OpenCode Zen, plus any
 * custom base URL) and Anthropic-compatible endpoints. Adding a new
 * provider is one entry in PROVIDERS below — no client.ts edits needed.
 *
 * The list is intentionally small and focused. Each entry has:
 *   - id: stable string stored in ApiKey.provider (free string in DB)
 *   - label: shown in the UI
 *   - kind: which API shape to call (openai | anthropic)
 *   - baseUrl: chat completions endpoint
 *   - models: a list of recommended model IDs the user can pick
 *   - docs: link to the provider's API key page
 */
export type ProviderKind = "openai" | "anthropic";

export type ProviderDef = {
  id: string;
  label: string;
  /** Short subtitle shown under the label. */
  blurb: string;
  kind: ProviderKind;
  baseUrl: string;
  /** Recommended models. The UI shows these in a picker. */
  models: string[];
  /** Default model when the user hasn't picked one. */
  defaultModel: string;
  /** Where the user gets an API key. */
  docs: string;
  /** Whether the user can override baseUrl. True for "Custom" providers. */
  customBaseUrl?: boolean;
};

/** Static registry. Add new providers here, nothing else. */
export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI",
    blurb: "GPT-4o, GPT-4.1, o1, o3, etc.",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o1", "o1-mini", "o3-mini"],
    defaultModel: "gpt-4o-mini",
    docs: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    blurb: "Claude 3.5 / 3.7 / Sonnet / Haiku / Opus",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com/v1/messages",
    models: [
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20241022",
      "claude-3-7-sonnet-20250219",
      "claude-opus-4-20250514",
    ],
    defaultModel: "claude-3-5-haiku-20241022",
    docs: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "opencode-go",
    label: "OpenCode Go",
    blurb: "OpenAI-compatible. Free tier for local dev experiments.",
    kind: "openai",
    baseUrl: "https://go.opencode.ai/v1/chat/completions",
    models: [
      "gpt-4o-mini",
      "claude-3-5-sonnet",
      "qwen2.5-coder:32b",
      "llama-3.3-70b",
    ],
    defaultModel: "gpt-4o-mini",
    docs: "https://opencode.ai/docs/go",
  },
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    blurb: "OpenAI-compatible. Curated model marketplace.",
    kind: "openai",
    baseUrl: "https://zen.opencode.ai/v1/chat/completions",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "claude-3-5-sonnet",
      "claude-3-7-sonnet",
      "gemini-2.0-flash",
    ],
    defaultModel: "gpt-4o",
    docs: "https://opencode.ai/docs/zen",
  },
  {
    id: "custom-openai",
    label: "Custom (OpenAI-compatible)",
    blurb: "Any OpenAI-compatible endpoint — Ollama, vLLM, LM Studio, etc.",
    kind: "openai",
    baseUrl: "", // user-provided
    models: [],  // user-provided (free-text)
    defaultModel: "",
    docs: "",
    customBaseUrl: true,
  },
];

/** Look up a provider by id. */
export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Default provider for first-time users. */
export const DEFAULT_PROVIDER_ID = "openai";

/** Build the chat completions URL for a provider, substituting custom base. */
export function resolveChatUrl(
  provider: ProviderDef,
  customBaseUrl?: string
): string {
  if (provider.customBaseUrl) {
    if (!customBaseUrl) {
      throw new Error(
        `Provider ${provider.id} requires a base URL (e.g. http://localhost:11434/v1/chat/completions)`
      );
    }
    // Normalize: strip trailing slashes, ensure /chat/completions.
    let base = customBaseUrl.replace(/\/+$/, "");
    if (!base.endsWith("/chat/completions")) {
      base = base.replace(/\/v1\/?$/, "") + "/v1/chat/completions";
    }
    return base;
  }
  return provider.baseUrl;
}

/**
 * Build the `/v1/models` URL for a provider. This is what we hit to
 * enumerate available models. For built-ins we derive it from baseUrl
 * (so the registry stays the single source of truth for endpoints).
 * For custom providers we normalize the user-supplied base.
 */
export function resolveModelsUrl(
  provider: ProviderDef,
  customBaseUrl?: string
): string {
  if (provider.customBaseUrl) {
    if (!customBaseUrl) {
      throw new Error(
        `Provider ${provider.id} requires a base URL to list models`
      );
    }
    let base = customBaseUrl.replace(/\/+$/, "");
    base = base.replace(/\/v1\/chat\/completions\/?$/, "/v1/models");
    base = base.replace(/\/chat\/completions\/?$/, "/v1/models");
    if (!base.endsWith("/v1/models")) {
      base = base.replace(/\/v1\/?$/, "") + "/v1/models";
    }
    return base;
  }
  // Built-ins: derive from baseUrl.
  // - OpenAI-compatible: baseUrl ends with /chat/completions → drop 2 segments → /v1/models
  // - Anthropic: baseUrl ends with /v1/messages → drop 1 segment → /v1/models
  const u = new URL(provider.baseUrl);
  const segments = u.pathname.split("/").filter(Boolean);
  if (provider.kind === "openai") {
    segments.pop(); // "completions"
    segments.pop(); // "chat"
  } else {
    segments.pop(); // "messages"
  }
  u.pathname = "/" + segments.join("/") + "/models";
  return u.toString();
}
