/**
 * Supabase OAuth provider list.
 *
 * Single source of truth for which third-party sign-in options we
 * expose. The login + signup UIs read this. Adding a new provider
 * (e.g. LinkedIn) is one row here + provider enablement in the
 * Supabase dashboard.
 */
import type { Provider } from "@supabase/supabase-js";

export type OAuthProvider = Extract<
  Provider,
  "google" | "apple" | "github" | "azure" | "facebook" | "linkedin" | "twitter"
>;

export type ProviderInfo = {
  id: OAuthProvider;
  label: string;
  /** Lowercased short name used in the URL: /api/auth/oauth/start?provider=google */
  slug: string;
  /** Tailwind class for the brand-color ring on the button. */
  ringClass: string;
  /** Short marketing copy shown under the button. */
  description: string;
};

export const OAUTH_PROVIDERS: ProviderInfo[] = [
  {
    id: "google",
    label: "Google",
    slug: "google",
    ringClass: "ring-blue-500/40",
    description: "Use your Google account",
  },
  {
    id: "apple",
    label: "Apple",
    slug: "apple",
    ringClass: "ring-zinc-400/40",
    description: "Use your Apple ID",
  },
  {
    id: "github",
    label: "GitHub",
    slug: "github",
    ringClass: "ring-zinc-700/40",
    description: "Use your GitHub account",
  },
];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return OAUTH_PROVIDERS.some((p) => p.slug === value);
}

export function getProvider(slug: string): ProviderInfo | undefined {
  return OAUTH_PROVIDERS.find((p) => p.slug === slug);
}
