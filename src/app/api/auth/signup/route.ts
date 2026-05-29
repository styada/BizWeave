import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applySessionCookie, hashPassword, signSessionToken } from "@/lib/auth";
import { signUpSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email, passwordHash, name },
    });

    const token = await signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email },
      redirect: "/onboarding",
    });
    return applySessionCookie(response, token);
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
