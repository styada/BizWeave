/**
 * Resolve an LLM credential for a user.
 *
 * Order: BYOK (any provider in the registry) -> platform-managed env
 * key (OpenAI or Anthropic) -> null. Returns null when no key exists;
 * callers fall back to deterministic templates.
 */
import { getPreferredProvider } from "@/lib/llm/keys";
import { optionalEnv } from "@/lib/env";
import { getProvider, type ProviderDef } from "./providers";

export type ResolvedLlm = {
  provider: string;
  apiKey: string;
  /** Resolved model id (from the saved key, or provider default). */
  model: string | null;
  /** Custom base URL (only for custom providers). */
  baseUrl: string | null;
  managed: boolean; // true if using the platform env key, not BYOK
  def: ProviderDef;
};

export async function resolveLlm(userId: string): Promise<ResolvedLlm | null> {
  const byok = await getPreferredProvider(userId);
  if (byok?.apiKey) {
    const def = getProvider(byok.provider);
    if (!def) return null;
    return { ...byok, managed: false, def };
  }

  const openai = optionalEnv("OPENAI_API_KEY");
  if (openai) {
    const def = getProvider("openai");
    if (def) return { provider: "openai", apiKey: openai, model: null, baseUrl: null, managed: true, def };
  }
  const anthropic = optionalEnv("ANTHROPIC_API_KEY");
  if (anthropic) {
    const def = getProvider("anthropic");
    if (def) return { provider: "anthropic", apiKey: anthropic, model: null, baseUrl: null, managed: true, def };
  }
  return null;
}
