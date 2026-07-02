/**
 * BYOK key storage and retrieval.
 *
 * Provider is a free string. The user can store keys for any provider
 * in the registry (src/lib/llm/providers.ts). Custom providers are
 * supported via the `baseUrl` column.
 */
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getProvider } from "./providers";

export type StoredKey = {
  provider: string;
  apiKey: string;
  model: string | null;
  baseUrl: string | null;
};

export async function getUserApiKey(
  userId: string,
  provider: string
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

/** Look up the first valid key the user has, in registry order. */
export async function getPreferredProvider(
  userId: string
): Promise<{
  provider: string;
  apiKey: string;
  model: string | null;
  baseUrl: string | null;
} | null> {
  const { PROVIDERS } = await import("./providers");
  for (const def of PROVIDERS) {
    const record = await db.apiKey.findUnique({
      where: { userId_provider: { userId, provider: def.id } },
    });
    if (record?.isValid) {
      try {
        const apiKey = decrypt(record.encryptedKey);
        return {
          provider: def.id,
          apiKey,
          model: record.model ?? null,
          baseUrl: record.baseUrl ?? null,
        };
      } catch {
        // Decrypt failed; skip.
      }
    }
  }
  return null;
}

export async function getStoredKey(
  userId: string,
  provider: string
): Promise<StoredKey | null> {
  const def = getProvider(provider);
  if (!def) return null;

  const record = await db.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!record?.isValid) return null;
  try {
    return {
      provider,
      apiKey: decrypt(record.encryptedKey),
      model: record.model ?? null,
      baseUrl: record.baseUrl ?? null,
    };
  } catch {
    return null;
  }
}
