import { optionalEnv, embeddingsModel } from "@/lib/env";
import { resolveLlm } from "@/lib/llm/resolve";

/**
 * Produce a 1536-dim embedding for text. Uses OpenAI embeddings when a key is
 * available (platform key first, then the user's BYOK OpenAI key). Returns null
 * when no embedding capability exists — the memory store then falls back to
 * keyword/recency retrieval.
 */
export async function embed(
  text: string,
  userId?: string
): Promise<number[] | null> {
  let apiKey = optionalEnv("OPENAI_API_KEY");
  if (!apiKey && userId) {
    const llm = await resolveLlm(userId);
    if (llm?.provider === "openai") apiKey = llm.apiKey;
  }
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: embeddingsModel(),
        input: text.slice(0, 8000),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/** Format a JS number[] as a pgvector literal, e.g. "[0.1,0.2,...]". */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}
