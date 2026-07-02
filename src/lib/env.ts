/**
 * Central environment + feature-flag access.
 *
 * Keep all `process.env` reads for optional/feature-gated capabilities here so
 * the rest of the codebase can ask `flags.deepExecutor` / `hasPlacesKey()`
 * instead of sprinkling `process.env` checks (and so absent keys degrade to
 * fallback/dry-run rather than crashing).
 */

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export const flags = {
  langgraph: bool(process.env.FEATURE_LANGGRAPH),
  deepExecutor: bool(process.env.FEATURE_DEEP_EXECUTOR),
  dreaming: bool(process.env.FEATURE_DREAMING),
  backlinkFreeTier: bool(process.env.FEATURE_BACKLINK_FREE_TIER, true),
} as const;

/** Returns the value or undefined if empty/unset (treats "" as unset). */
export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : undefined;
}

export const hasOpenAiKey = () => !!optionalEnv("OPENAI_API_KEY");
export const hasAnthropicKey = () => !!optionalEnv("ANTHROPIC_API_KEY");
export const hasPlacesKey = () => !!optionalEnv("GOOGLE_PLACES_API_KEY");
export const hasGeocodeKey = () => !!optionalEnv("GOOGLE_MAPS_API_KEY");
export const hasResendKey = () => !!optionalEnv("RESEND_API_KEY");
export const hasTwilioKeys = () =>
  !!optionalEnv("TWILIO_ACCOUNT_SID") && !!optionalEnv("TWILIO_AUTH_TOKEN");
export const hasVapiKey = () => !!optionalEnv("VAPI_API_KEY");
export const hasStripeKey = () => !!optionalEnv("STRIPE_SECRET_KEY");
export const hasVercelToken = () => !!optionalEnv("VERCEL_TOKEN");
export const hasMetaAdsKeys = () =>
  !!optionalEnv("META_ACCESS_TOKEN") && !!optionalEnv("META_AD_ACCOUNT_ID");

export const wildcardRootDomain = () =>
  optionalEnv("WILDCARD_ROOT_DOMAIN") ?? "bizweave.site";

export const embeddingsModel = () =>
  optionalEnv("EMBEDDINGS_MODEL") ?? "text-embedding-3-small";

export const appUrl = () =>
  optionalEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
