import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, keyHint } from "@/lib/crypto";
import { testConnection } from "@/lib/llm/client";
import { getProvider } from "@/lib/llm/providers";
import { apiKeySchema } from "@/lib/validations";

/** GET /api/keys — list all saved keys for the current user. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: session.id },
    select: {
      provider: true,
      keyHint: true,
      isValid: true,
      model: true,
      baseUrl: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ keys });
}

/** POST /api/keys — save or update a key. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = apiKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { provider, apiKey, model, baseUrl } = parsed.data;

    // Validate the provider is one we know about (or accept custom-* ids).
    if (!getProvider(provider)) {
      // Allow the user to add a custom-* id even if not in the registry
      // (escape hatch for private deployments).
      if (!provider.startsWith("custom-")) {
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
      }
    }

    // Custom OpenAI-compatible providers MUST have a baseUrl.
    if (provider === "custom-openai" && !baseUrl) {
      return NextResponse.json(
        { error: "Custom OpenAI-compatible providers require a base URL" },
        { status: 400 }
      );
    }

    // Probe the key before persisting. Failures here are non-fatal — we
    // still save the key but mark it invalid so the user can fix and retry.
    let isValid = false;
    let verifyError: string | undefined;
    try {
      isValid = await testConnection(
        provider,
        apiKey,
        model || (getProvider(provider)?.defaultModel ?? undefined)
      );
    } catch (err) {
      verifyError = err instanceof Error ? err.message : String(err);
      isValid = false;
    }

    await db.apiKey.upsert({
      where: { userId_provider: { userId: session.id, provider } },
      create: {
        userId: session.id,
        provider,
        encryptedKey: encrypt(apiKey),
        keyHint: keyHint(apiKey),
        isValid,
        model: model ?? null,
        baseUrl: baseUrl ?? null,
      },
      update: {
        encryptedKey: encrypt(apiKey),
        keyHint: keyHint(apiKey),
        isValid,
        model: model ?? null,
        baseUrl: baseUrl ?? null,
      },
    });

    return NextResponse.json({ ok: true, isValid, verifyError });
  } catch (error) {
    console.error("API key error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save API key" },
      { status: 500 }
    );
  }
}

/** DELETE /api/keys?provider=X — remove a saved key. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  if (!provider) {
    return NextResponse.json({ error: "Provider required" }, { status: 400 });
  }

  await db.apiKey.deleteMany({
    where: { userId: session.id, provider },
  });

  return NextResponse.json({ ok: true });
}

/** GET /api/keys/providers — list the known provider registry. */
export async function GET_PROVIDERS() {
  return NextResponse.json({ providers: PROVIDERS });
}
