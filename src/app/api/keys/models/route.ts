import { NextResponse } from "next/server";
import { listModels } from "@/lib/llm/client";

/**
 * GET /api/keys/models?provider=X&apiKey=Y[&baseUrl=Z]
 *
 * Probes the provider's /v1/models endpoint and returns the live list of
 * available model IDs. Never returns an error — an empty list just means
 * "couldn't reach the provider" and the UI will fall back to its curated
 * list.
 *
 * Not auth-gated: the caller already has a freshly-pasted key in memory
 * and we're just listing, not using, the key. Avoids round-tripping the
 * key through the user session.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") ?? "";
  const apiKey = searchParams.get("apiKey") ?? "";
  const baseUrl = searchParams.get("baseUrl") ?? undefined;

  if (!provider) {
    return NextResponse.json({ models: [] });
  }
  if (!apiKey) {
    // Without a key we can't hit the provider — but the UI can still
    // want the curated list, so return an empty array and let it fall back.
    return NextResponse.json({ models: [] });
  }

  const models = await listModels(provider, apiKey, baseUrl);
  return NextResponse.json({ models });
}
