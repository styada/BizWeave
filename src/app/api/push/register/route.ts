import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  token: z.string().min(10),
  platform: z.enum(["ios", "android"]).optional(),
});

/** Register (or refresh) an Expo push token for the signed-in user. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  await db.pushToken.upsert({
    where: { token: parsed.data.token },
    create: { userId: session.id, token: parsed.data.token, platform: parsed.data.platform },
    update: { userId: session.id, platform: parsed.data.platform, lastUsedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

/** Unregister a token (on logout). */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token) {
    await db.pushToken.deleteMany({ where: { token, userId: session.id } });
  }
  return NextResponse.json({ ok: true });
}
