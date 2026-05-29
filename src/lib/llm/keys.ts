import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import type { LLMProvider } from "./types";

export async function getUserApiKey(
  userId: string,
  provider: LLMProvider
): Promise<string | null> {
  const record = await db.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!record?.isValid) return null;
  try {
    return decrypt(record.encryptedKey);
  } catch {
    return null;
  }
}

export async function getPreferredProvider(
  userId: string
): Promise<{ provider: LLMProvider; apiKey: string } | null> {
  for (const provider of ["openai", "anthropic"] as const) {
    const apiKey = await getUserApiKey(userId, provider);
    if (apiKey) return { provider, apiKey };
  }
  return null;
}
