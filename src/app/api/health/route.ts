import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  flags,
  hasOpenAiKey,
  hasAnthropicKey,
  hasPlacesKey,
  hasResendKey,
  hasTwilioKeys,
  hasVapiKey,
  hasStripeKey,
  hasVercelToken,
  hasMetaAdsKeys,
} from "@/lib/env";
import { tracingEnabled } from "@/lib/pipeline/tracing";

/**
 * Liveness + readiness probe. Reports DB connectivity, enabled feature flags,
 * and which capabilities are configured (for launch-readiness dashboards).
 */
export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const capabilities = {
    llm: { openai: hasOpenAiKey(), anthropic: hasAnthropicKey() },
    places: hasPlacesKey(),
    email: hasResendKey(),
    sms: hasTwilioKeys(),
    voice: hasVapiKey(),
    billing: hasStripeKey(),
    hosting: hasVercelToken(),
    ads: hasMetaAdsKeys(),
    tracing: tracingEnabled(),
  };

  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      db: dbOk,
      flags,
      capabilities,
      time: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 }
  );
}
