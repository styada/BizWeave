import { NextResponse } from "next/server";
import { z } from "zod";
import { isOAuthProvider } from "@/lib/supabase/providers";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  provider: z.string().min(1).max(32),
  /** Where to send the user after the OAuth round-trip. */
  redirect: z.string().optional(),
});

/**
 * Start an OAuth flow with Supabase. The provider verifies identity and
 * redirects back to /api/auth/oauth/callback with a `code`. We don't
 * create any user state here — that happens in the callback.
 *
 * Why a server route (not just calling the client SDK from the page)?
 * - The redirect URL must be a server-controlled absolute URL (Supabase
 *   validates it against the allow-list in the dashboard).
 * - We can use the server client to get the canonical provider URL,
 *   which is robust to ad-blockers and SSR.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    provider: url.searchParams.get("provider") ?? "",
    redirect: url.searchParams.get("redirect") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!isOAuthProvider(parsed.data.provider)) {
    return NextResponse.json(
      { error: `Unknown provider: ${parsed.data.provider}` },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const callbackUrl = new URL("/api/auth/oauth/callback", appUrl);
  if (parsed.data.redirect) {
    // Only accept same-origin redirect paths.
    const dest = parsed.data.redirect;
    if (dest.startsWith("/") && !dest.startsWith("//")) {
      callbackUrl.searchParams.set("redirect", dest);
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data.provider,
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: parsed.data.provider === "google"
        ? "openid email profile"
        : undefined,
    },
  });

  if (error || !data?.url) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to start OAuth" },
      { status: 500 }
    );
  }
  // Redirect the browser to the provider's consent screen.
  return NextResponse.redirect(data.url);
}
