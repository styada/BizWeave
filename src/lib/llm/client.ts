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
