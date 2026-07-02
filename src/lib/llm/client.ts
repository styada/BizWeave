/**
 * LLM client. Dispatches by `kind` (openai | anthropic) from the
 * provider registry. No hardcoded provider branches.
 *
 * Adding a new OpenAI-compatible provider is one entry in
 * providers.ts; nothing in this file needs to change.
 */
import type { LLMMessage, LLMOptions, LLMResponse } from "./types";
import { getProvider, resolveChatUrl, type ProviderDef } from "./providers";

// 30s default — long enough for a slow model, short enough that a hung
// fetch (e.g. bad key, blocked egress) doesn't tie up the chat handler.
const DEFAULT_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function resolveProvider(options: LLMOptions): ProviderDef {
  const def = getProvider(options.provider);
  if (!def) {
    throw new Error(
      `Unknown LLM provider: ${options.provider}. Add it to src/lib/llm/providers.ts.`
    );
  }
  return def;
}

export async function complete(
  messages: LLMMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const def = resolveProvider(options);
  const model = options.model ?? def.defaultModel;
  if (!model) {
    throw new Error(
      `Provider ${def.id} requires a model. Pass options.model or set a default in providers.ts.`
    );
  }
  if (def.kind === "openai") {
    return completeOpenAI(messages, { ...options, def, model });
  }
  return completeAnthropic(messages, { ...options, def, model });
}

async function completeOpenAI(
  messages: LLMMessage[],
  options: LLMOptions & { def: ProviderDef; model: string }
): Promise<LLMResponse> {
  const url = resolveChatUrl(options.def, options.baseUrl);
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `OpenAI-compatible error (${options.def.id}, ${res.status}): ${await res.text()}`
    );
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    model: string;
  };

  return {
    content: data.choices[0]?.message?.content ?? "",
    model: data.model,
    provider: options.def.id,
  };
}

async function completeAnthropic(
  messages: LLMMessage[],
  options: LLMOptions & { def: ProviderDef; model: string }
): Promise<LLMResponse> {
  const url = options.def.baseUrl;
  const system = messages.find((m) => m.role === "system")?.content;
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      system,
      messages: chatMessages,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Anthropic-compatible error (${options.def.id}, ${res.status}): ${await res.text()}`
    );
  }

  const data = (await res.json()) as {
    content: { type: string; text: string }[];
    model: string;
  };

  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  return {
    content: text,
    model: data.model,
    provider: options.def.id,
  };
}

/**
 * Probe the provider with a 1-token call. Used by /api/keys to verify
 * a key before persisting it.
 */
export async function testConnection(
  provider: string,
  apiKey: string,
  model?: string
): Promise<boolean> {
  try {
    await complete(
      [{ role: "user", content: "Reply with exactly: OK" }],
      { provider, apiKey, model, maxTokens: 10, temperature: 0 }
    );
    return true;
  } catch {
    return false;
  }
}

export type ListedModel = {
  id: string;
  /** OpenAI returns "owned_by"; Anthropic returns no owner. */
  ownedBy?: string;
  /** Some providers tag the model with a kind. */
  kind?: string;
};

/**
 * List the models available on a provider. We hit the provider's own
 * /v1/models endpoint (or equivalent) and return just the ids. Never
 * throws — returns an empty array on any failure so the UI can fall
 * back to a curated list.
 *
 * The custom provider (customBaseUrl=true) requires `baseUrl`.
 */
export async function listModels(
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<ListedModel[]> {
  if (!apiKey) return [];
  let def: ProviderDef;
  try {
    def = resolveProvider({ provider, apiKey, baseUrl });
  } catch {
    return [];
  }
  if (def.customBaseUrl && !baseUrl) return [];

  // Lazy-import to keep the provider module as the source of truth.
  const { resolveModelsUrl } = await import("./providers");
  const url = resolveModelsUrl(def, baseUrl);

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: authHeaders(def, apiKey),
      },
      // Shorter timeout — this is a UI helper, not a chat call.
      10_000
    );
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return parseModelsResponse(def.kind, data);
  } catch {
    return [];
  }
}

function authHeaders(def: ProviderDef, apiKey: string): Record<string, string> {
  if (def.kind === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function parseModelsResponse(
  kind: ProviderDef["kind"],
  data: unknown
): ListedModel[] {
  // OpenAI: { data: [{ id, owned_by, ... }, ...] }
  // Anthropic: { data: [{ id, display_name, type, ... }, ...] }
  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    Array.isArray((data as { data: unknown }).data)
  ) {
    return (data as { data: unknown[] }).data
      .map((m): ListedModel | null => {
        if (!m || typeof m !== "object") return null;
        const obj = m as Record<string, unknown>;
        const id = obj.id;
        if (typeof id !== "string" || !id) return null;
        if (kind === "openai") {
          return {
            id,
            ownedBy: typeof obj.owned_by === "string" ? obj.owned_by : undefined,
          };
        }
        return {
          id,
          ownedBy: typeof obj.display_name === "string" ? obj.display_name : undefined,
          kind: typeof obj.type === "string" ? obj.type : undefined,
        };
      })
      .filter((m): m is ListedModel => m !== null);
  }
  // Ollama-style: { models: [{ name, ... }, ...] }
  if (
    data &&
    typeof data === "object" &&
    "models" in data &&
    Array.isArray((data as { models: unknown }).models)
  ) {
    return (data as { models: unknown[] }).models
      .map((m): ListedModel | null => {
        if (!m || typeof m !== "object") return null;
        const obj = m as Record<string, unknown>;
        const name = obj.name ?? obj.id;
        if (typeof name !== "string" || !name) return null;
        return { id: name, ownedBy: typeof obj.details?.family === "string" ? obj.details.family : undefined };
      })
      .filter((m): m is ListedModel => m !== null);
  }
  return [];
}
