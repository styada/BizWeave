import type { LLMMessage, LLMOptions, LLMResponse } from "./types";

const DEFAULT_MODELS: Record<LLMOptions["provider"], string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
};

export async function complete(
  messages: LLMMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const model = options.model ?? DEFAULT_MODELS[options.provider];

  if (options.provider === "openai") {
    return completeOpenAI(messages, { ...options, model });
  }
  return completeAnthropic(messages, { ...options, model });
}

async function completeOpenAI(
  messages: LLMMessage[],
  options: LLMOptions & { model: string }
): Promise<LLMResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    model: string;
  };

  return {
    content: data.choices[0]?.message?.content ?? "",
    model: data.model,
    provider: "openai",
  };
}

async function completeAnthropic(
  messages: LLMMessage[],
  options: LLMOptions & { model: string }
): Promise<LLMResponse> {
  const system = messages.find((m) => m.role === "system")?.content;
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
    const err = await res.text();
    throw new Error(`Anthropic error: ${res.status} ${err}`);
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
    provider: "anthropic",
  };
}

export async function testConnection(
  provider: LLMOptions["provider"],
  apiKey: string
): Promise<boolean> {
  try {
    await complete(
      [{ role: "user", content: 'Reply with exactly: OK' }],
      { provider, apiKey, maxTokens: 10, temperature: 0 }
    );
    return true;
  } catch {
    return false;
  }
}
