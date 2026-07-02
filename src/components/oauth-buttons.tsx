"use client";

import { Button } from "@/components/ui/button";
import { OAUTH_PROVIDERS } from "@/lib/supabase/providers";

/**
 * "Continue with Google / Apple / GitHub" buttons. Each link points to
 * /api/auth/oauth/start?provider=X which redirects to the provider.
 *
 * This is a server-side redirect (not a fetch) so the user lands on
 * the provider's consent screen with proper cookies. No JS handler
 * needed — the browser follows the link.
 */
export function OAuthButtons({ redirect = "/dashboard" }: { redirect?: string }) {
  return (
    <div className="grid gap-2">
      {OAUTH_PROVIDERS.map((provider) => (
        <a
          key={provider.slug}
          href={`/api/auth/oauth/start?provider=${provider.slug}&redirect=${encodeURIComponent(redirect)}`}
          aria-label={`Continue with ${provider.label}`}
          className="block"
        >
          <Button
            type="button"
            variant="outline"
            className={`w-full justify-center gap-2 ring-1 ring-inset ${provider.ringClass}`}
          >
            <ProviderIcon id={provider.slug} />
            <span>Continue with {provider.label}</span>
          </Button>
        </a>
      ))}
    </div>
  );
}

/** Inline brand mark for each provider. SVG-only, no external assets. */
function ProviderIcon({ id }: { id: string }) {
  if (id === "google") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="#EA4335" d="M12 11v3.2h7.5c-.3 1.7-2 5-7.5 5-4.5 0-8.2-3.7-8.2-8.2S7.5 2.8 12 2.8c2.6 0 4.3 1.1 5.3 2l3.6-3.5C18.7-.7 15.6 0 12 0 5.4 0 0 5.4 0 12s5.4 12 12 12c6.9 0 11.5-4.8 11.5-11.6 0-.8-.1-1.4-.2-2H12z" />
      </svg>
    );
  }
  if (id === "apple") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M16.4 1.6c0 1.1-.4 2.1-1.2 2.9-.9.9-1.9 1.4-2.9 1.3-.1-1.1.3-2.1 1.1-2.9.9-.9 2-1.4 3-1.3zM20 17.4c-.6 1.4-1 2-1.7 3.1-1 1.5-2.4 3.4-4.1 3.4-1.5 0-1.9-1-3.9-1-2 0-2.4 1-3.9 1-1.7 0-3-1.7-4-3.2-2.7-4.2-3-9.1-1.3-11.7 1.2-1.9 3.1-3 4.9-3 1.8 0 3 1 4.5 1 1.5 0 2.4-1 4.5-1 1.6 0 3.3.9 4.5 2.4-4 2.2-3.4 7.9.5 9z" />
      </svg>
    );
  }
  if (id === "github") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.3-3.3-.1-.3-.6-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 2.9.1 3.2.8.9 1.3 2 1.3 3.3 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
      </svg>
    );
  }
  return null;
}
