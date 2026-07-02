import { complete } from "@/lib/llm/client";
import { resolveLlm } from "@/lib/llm/resolve";
import { parseWithSchema } from "@/lib/agents/contracts";
import type { AgentId } from "@/lib/agents/types";

const AGENT_TIMEOUT_MS = 45_000;
const STEP_MAX_ATTEMPTS = 2;

export type StepResult<T> = { value: T; raw: string; usedFallback: boolean };

/**
 * Run one structured agent step: LLM call (with timeout + retry) validated
 * against a Zod schema, falling back to a deterministic template on failure.
 * Shared by both the legacy loop and the LangGraph-style DAG engine so behavior
 * stays identical (parity).
 */
export async function runStructuredAgent<T>(params: {
  agent: AgentId;
  prompt: string;
  userId: string;
  useLlm: boolean;
  fallback: T;
  schema: Parameters<typeof parseWithSchema<T>>[1];
}): Promise<StepResult<T>> {
  if (!params.useLlm) {
    return { value: params.fallback, raw: JSON.stringify(params.fallback), usedFallback: true };
  }
  const llm = await resolveLlm(params.userId);
  if (!llm) {
    return { value: params.fallback, raw: JSON.stringify(params.fallback), usedFallback: true };
  }

  let lastRaw = "";
  for (let attempt = 1; attempt <= STEP_MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await withTimeout(
        complete(
          [
            {
              role: "system",
              content:
                "You are a specialized AI agent for Bizweave. Follow instructions precisely. Return only the requested format.",
            },
            { role: "user", content: params.prompt },
          ],
          { provider: llm.provider, apiKey: llm.apiKey, temperature: 0.6 }
        ),
        AGENT_TIMEOUT_MS,
        params.agent
      );
      lastRaw = raw.content;
      const parsed = parseWithSchema(raw.content, params.schema, params.fallback);
      if (!parsed.usedFallback) return { value: parsed.value, raw: raw.content, usedFallback: false };
    } catch {
      // retry
    }
  }
  return { value: params.fallback, raw: lastRaw || JSON.stringify(params.fallback), usedFallback: true };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}
