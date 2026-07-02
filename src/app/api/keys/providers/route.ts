import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/llm/providers";

/** GET /api/keys/providers — list the known provider registry.
 *  Public: the registry is not user-specific, just informational. */
export async function GET() {
  // Strip the baseUrl from the response (internal detail). Keep id,
  // label, blurb, kind, models, defaultModel, docs, customBaseUrl.
  return NextResponse.json({
    providers: PROVIDERS.map((p) => ({
      id: p.id,
      label: p.label,
      blurb: p.blurb,
      kind: p.kind,
      models: p.models,
      defaultModel: p.defaultModel,
      docs: p.docs,
      customBaseUrl: !!p.customBaseUrl,
    })),
  });
}
