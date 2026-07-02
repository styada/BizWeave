import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";

import { COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth-constants";

export { COOKIE_NAME, SESSION_MAX_AGE };

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SESSION_MAX_AGE,
  path: "/",
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

/** Attach session cookie to a Route Handler response (required for fetch-based auth). */
export function applySessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(COOKIE_NAME, token, sessionCookieOptions);
  return response;
}

export async function createSession(user: SessionUser) {
  const token = await signSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions);
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const id = payload.sub;
      if (!id || typeof id !== "string") return null;

      const user = await db.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true },
      });
      return user;
    } catch {
      // Fall through to Supabase session lookup when legacy cookie verification fails.
    }
  }

  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !supabaseUser?.email) {
    return null;
  }

  if (!supabaseUser.id) {
    return null;
  }

  const metadata = supabaseUser.user_metadata ?? {};
  const inferredName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    null;

  const userBySupabaseId = await db.user.findUnique({
    where: { supabaseAuthId: supabaseUser.id },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (userBySupabaseId) {
    return userBySupabaseId;
  }

  const existingByEmail = await db.user.findUnique({
    where: { email: supabaseUser.email },
    select: { id: true },
  });

  if (existingByEmail) {
    return db.user.update({
      where: { id: existingByEmail.id },
      data: {
        supabaseAuthId: supabaseUser.id,
        name: inferredName,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  return db.user.create({
    data: {
      supabaseAuthId: supabaseUser.id,
      email: supabaseUser.email,
      name: inferredName,
      // Password is managed by Supabase for this flow; keep schema compatibility.
      passwordHash: await hashPassword(crypto.randomUUID()),
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
