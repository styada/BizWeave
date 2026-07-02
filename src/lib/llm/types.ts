/**
 * LLM client types. The provider is a free string (matches
 * ApiKey.provider in the DB). The client dispatches by `kind`
 * (openai | anthropic), not by hardcoded provider branches.
 */
export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Options for an LLM call. `provider` is any id from
 * src/lib/llm/providers.ts. `model` defaults to the provider's default.
 */
export type LLMOptions = {
  provider: string;
  apiKey: string;
  model?: string;
  /** Custom base URL (only used when provider.customBaseUrl === true). */
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
};

export type LLMResponse = {
  content: string;
  model: string;
  provider: string;
};
