export type LLMProvider = "openai" | "anthropic";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export type LLMResponse = {
  content: string;
  model: string;
  provider: LLMProvider;
};
