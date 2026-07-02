import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export type ConnectorHealth = {
  provider: string;
  status: "connected" | "expired" | "error" | "revoked";
  lastCheckedAt: Date | null;
  healthy: boolean;
};

const SUPPORTED_CONNECTORS = [
  "square",
  "quickbooks",
  "google_calendar",
  "google_business",
  "meta",
  "yelp",
  "shopify",
] as const;

/** List connectors available in the marketplace. */
export function listConnectors(): string[] {
  return [...SUPPORTED_CONNECTORS];
}

/** Store encrypted OAuth credentials for a connector. */
export async function saveConnection(params: {
  businessId: string;
  provider: string;
  kind: string;
  credentials: Record<string, string>;
  scopes?: string[];
  expiresAt?: Date;
}): Promise<void> {
  const encryptedCredentials = encrypt(JSON.stringify(params.credentials));
  await db.integrationConnection.upsert({
    where: { businessId_provider: { businessId: params.businessId, provider: params.provider } },
    create: {
      businessId: params.businessId,
      provider: params.provider,
      kind: params.kind,
      encryptedCredentials,
      scopes: params.scopes ?? undefined,
      expiresAt: params.expiresAt ?? null,
      status: "connected",
      lastCheckedAt: new Date(),
    },
    update: {
      encryptedCredentials,
      scopes: params.scopes ?? undefined,
      expiresAt: params.expiresAt ?? undefined,
      status: "connected",
      lastCheckedAt: new Date(),
    },
  });
}

/** Health-check all connections for a business. */
export async function checkConnectorHealth(businessId: string): Promise<ConnectorHealth[]> {
  const rows = await db.integrationConnection.findMany({ where: { businessId } });
  const results: ConnectorHealth[] = [];

  for (const row of rows) {
    let healthy = row.status === "connected";
    if (row.expiresAt && row.expiresAt < new Date()) {
      healthy = false;
      await db.integrationConnection.update({
        where: { id: row.id },
        data: { status: "expired" },
      });
    }
    results.push({
      provider: row.provider,
      status: healthy ? "connected" : (row.status as ConnectorHealth["status"]),
      lastCheckedAt: row.lastCheckedAt,
      healthy,
    });
  }
  return results;
}

/** Decrypt stored credentials (server-side only). */
export function readCredentials(encrypted: string): Record<string, string> {
  try {
    return JSON.parse(decrypt(encrypted)) as Record<string, string>;
  } catch {
    return {};
  }
}
