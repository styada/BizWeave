import { optionalEnv } from "@/lib/env";

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress?: string;
};

/**
 * Geocode a free-form address to lat/lng using the Google Geocoding API.
 *
 * Degrades gracefully: if `GOOGLE_MAPS_API_KEY` is not configured (or the
 * request fails), returns `null` instead of throwing — callers persist the
 * business without coordinates and competitor seeding is skipped until a key
 * is added.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const key = optionalEnv("GOOGLE_MAPS_API_KEY");
  const trimmed = address.trim();
  if (!key || trimmed.length === 0) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", trimmed);
    url.searchParams.set("key", key);

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results: {
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
      }[];
    };

    const first = data.results?.[0];
    if (data.status !== "OK" || !first) return null;

    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
    };
  } catch {
    return null;
  }
}

/** Compose a single-line address from structured onboarding fields. */
export function composeAddress(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string {
  return [
    parts.addressLine1,
    parts.addressLine2,
    parts.city,
    parts.region,
    parts.postalCode,
    parts.country,
  ]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}
