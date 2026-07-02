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
    blurb: "OpenCode's low-cost subscription for open coding models.",
    kind: "openai",
    baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
    /**
     * Fallback list of models available through OpenCode Go as of
     * 2026-07-02. The live list is fetched at
     * https://opencode.ai/zen/go/v1/models and may change as new
     * open models are benchmarked.
     */
    models: [
      "minimax-m3",
      "minimax-m2.7",
      "minimax-m2.5",
      "kimi-k2.7-code",
      "kimi-k2.6",
      "kimi-k2.5",
      "glm-5.2",
      "glm-5.1",
      "glm-5",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "qwen3.7-max",
      "qwen3.7-plus",
      "qwen3.6-plus",
      "qwen3.5-plus",
      "mimo-v2.5-pro",
      "mimo-v2.5",
      "hy3-preview",
    ],
    defaultModel: "minimax-m3",
    docs: "https://opencode.ai/auth",
  },
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    blurb: "OpenCode's curated model gateway (Claude, GPT, Gemini, more).",
    kind: "openai",
    baseUrl: "https://opencode.ai/zen/v1/chat/completions",
    /**
     * Fallback list of models available through OpenCode Zen as of
     * 2026-07-02. The live list is fetched at
     * https://opencode.ai/zen/v1/models and may change as new models
     * are added or deprecated.
     *
     * NOTE: OpenCode Zen exposes several endpoint shapes depending on
     * the model (chat/completions, messages, responses, and per-Gemini
     * model routes). The gateway accepts chat-completions format for
     * any model, so this single baseUrl is the recommended entry
     * point. Users who need a specific endpoint can use the Custom
     * provider.
     */
    models: [
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-opus-4-5",
      "claude-opus-4-1",
      "claude-sonnet-5",
      "claude-sonnet-4-6",
      "claude-sonnet-4-5",
      "claude-sonnet-4",
      "claude-haiku-4-5",
      "gemini-3.5-flash",
      "gemini-3.1-pro",
      "gemini-3-flash",
      "gpt-5.5",
      "gpt-5.5-pro",
      "gpt-5.4",
      "gpt-5.4-pro",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5.3-codex-spark",
      "gpt-5.3-codex",
      "gpt-5.2",
      "gpt-5.2-codex",
      "gpt-5.1",
      "gpt-5.1-codex-max",
      "gpt-5.1-codex",
      "gpt-5.1-codex-mini",
      "gpt-5",
      "gpt-5-codex",
      "gpt-5-nano",
      "grok-build-0.1",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "glm-5.2",
      "glm-5.1",
      "glm-5",
      "minimax-m3",
      "minimax-m2.7",
      "minimax-m2.5",
      "kimi-k2.7-code",
      "kimi-k2.6",
      "kimi-k2.5",
      "qwen3.6-plus",
      "qwen3.5-plus",
      "big-pickle",
      "deepseek-v4-flash-free",
      "mimo-v2.5-free",
      "nemotron-3-ultra-free",
      "north-mini-code-free",
    ],
    defaultModel: "claude-sonnet-5",
    docs: "https://opencode.ai/auth",
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
