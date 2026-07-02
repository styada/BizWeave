import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signSessionToken, applySessionCookie } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Provider } from "@supabase/supabase-js";

/**
 * OAuth callback: the user lands here after Google/Apple/GitHub consents.
 *
 * 1. Exchange the `code` for a Supabase session (set HttpOnly cookies).
 * 2. Read the Supabase user (email + provider id + metadata).
 * 3. Provision or update the Bizweave User row, linking supabaseAuthId.
 * 4. Mint a Bizweave JWT cookie (same as /api/auth/login does) so the
 *    rest of the app keeps using getSession() unchanged.
 * 5. Redirect to the original destination (default /onboarding).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirect = url.searchParams.get("redirect") ?? "/onboarding";
  const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/onboarding";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, url)
    );
  }

  const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();
  if (userError || !supabaseUser?.email) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_no_user", url)
    );
  }

  // Provision or update the Bizweave User row.
  const provider = (supabaseUser.app_metadata?.provider as Provider | undefined) ?? "google";
  const metadata = supabaseUser.user_metadata ?? {};
  const inferredName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    null;

  // Find or create. Three cases:
  //  (a) User signed up with this Supabase account before — link by supabaseAuthId.
  //  (b) User signed up with email/password using the same email — link them.
  //  (c) New user — create a fresh row.
  let user = await db.user.findUnique({
    where: { supabaseAuthId: supabaseUser.id },
  });

  if (!user) {
    user = await db.user.findUnique({ where: { email: supabaseUser.email.toLowerCase() } });
    if (user) {
      // Link the existing email-based account to the OAuth provider.
      user = await db.user.update({
        where: { id: user.id },
        data: {
          supabaseAuthId: supabaseUser.id,
          name: user.name ?? inferredName,
        },
      });
    }
  }

  if (!user) {
    // No password for OAuth users. bcrypt is required by the schema (NOT NULL)
    // so we set a random unguessable value; the user logs in via OAuth and
    // never sees it.
    const { randomBytes } = await import("node:crypto");
    const randomHash = await import("bcryptjs").then((m) =>
      m.hash(randomBytes(32).toString("hex"), 12)
    );
    user = await db.user.create({
      data: {
        email: supabaseUser.email.toLowerCase(),
        passwordHash: randomHash,
        name: inferredName,
        supabaseAuthId: supabaseUser.id,
      },
    });
  }

  // Mint the Bizweave JWT cookie so getSession() picks up the new user.
  const token = await signSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });
  const response = NextResponse.redirect(new URL(safeRedirect, url));
  return applySessionCookie(response, token);
}
