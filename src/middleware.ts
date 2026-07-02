import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { wildcardRootDomain } from "@/lib/env";

/**
 * Auth guard middleware.
 *
 * Protected route prefixes require a session (either the Bizweave JWT cookie
 * or a Supabase auth cookie). Everything else (marketing, auth pages, public
 * generated sites, auth API routes) is public. Deep authz (ownership checks,
 * JWT verification, DB lookups) happens in `getSession()` server-side — this
 * layer just keeps unauthenticated users out of the app shell.
 */

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/protected"];

function hasSessionCookie(request: NextRequest): boolean {
  if (request.cookies.get(COOKIE_NAME)?.value) return true;
  // Supabase SSR sets cookies prefixed with `sb-` (…-auth-token).
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")) {
      return true;
    }
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const root = wildcardRootDomain();

  // Wildcard subdomain → /site/[slug] (instant-live hosting, Phase 23).
  if (host.endsWith(`.${root}`) && host !== root && !host.startsWith("app.")) {
    const slug = host.replace(`.${root}`, "");
    if (slug && !slug.includes(".")) {
      const url = request.nextUrl.clone();
      url.pathname = `/site/${slug}`;
      return NextResponse.rewrite(url);
    }
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !hasSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
