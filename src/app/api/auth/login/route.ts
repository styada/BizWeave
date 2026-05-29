import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applySessionCookie, signSessionToken, verifyPassword } from "@/lib/auth";
import { signInSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    const response = NextResponse.json({ ok: true, redirect: "/dashboard" });
    return applySessionCookie(response, token);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
