import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, keyHint } from "@/lib/crypto";
import { testConnection } from "@/lib/llm/client";
import { apiKeySchema } from "@/lib/validations";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: session.id },
    select: { provider: true, keyHint: true, isValid: true, updatedAt: true },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = apiKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 400 });
    }

    const { provider, apiKey } = parsed.data;
    const isValid = await testConnection(provider, apiKey);

    await db.apiKey.upsert({
      where: { userId_provider: { userId: session.id, provider } },
      create: {
        userId: session.id,
        provider,
        encryptedKey: encrypt(apiKey),
        keyHint: keyHint(apiKey),
        isValid,
      },
      update: {
        encryptedKey: encrypt(apiKey),
        keyHint: keyHint(apiKey),
        isValid,
      },
    });

    return NextResponse.json({ ok: true, isValid });
  } catch (error) {
    console.error("API key error:", error);
    return NextResponse.json({ error: "Failed to save API key" }, { status: 500 });
  }
}

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
