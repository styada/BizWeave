import { getPreferredProvider } from "@/lib/llm/keys";
import { optionalEnv } from "@/lib/env";
import type { LLMProvider } from "@/lib/llm/types";

export type ResolvedLlm = {
  provider: LLMProvider;
  apiKey: string;
  managed: boolean; // true if using the platform key (not the user's BYOK)
};

/**
 * Resolve an LLM credential for a user: prefer their BYOK key, else fall back
 * to the platform-managed key (Appendix D.3). Returns null if neither exists —
 * callers then use the deterministic template fallback (demo mode).
 */
export async function resolveLlm(userId: string): Promise<ResolvedLlm | null> {
  const byok = await getPreferredProvider(userId);
  if (byok) return { ...byok, managed: false };

  const openai = optionalEnv("OPENAI_API_KEY");
  if (openai) return { provider: "openai", apiKey: openai, managed: true };

  const anthropic = optionalEnv("ANTHROPIC_API_KEY");
  if (anthropic) return { provider: "anthropic", apiKey: anthropic, managed: true };

  return null;
}
