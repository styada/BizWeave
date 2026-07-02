import { z } from "zod";
import type { McpTool } from "@/lib/mcp/types";
import { optionalEnv } from "@/lib/env";

const nearbyInput = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMeters: z.number().min(50).max(50000).default(3000),
  includedType: z.string().optional(), // e.g. "liquor_store", "restaurant"
  maxResults: z.number().min(1).max(20).default(15),
});

export type NearbyPlace = {
  placeId: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  website?: string;
  phone?: string;
  types?: string[];
};

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/**
 * Google Places API (New) Nearby Search. Read-only. Degrades to an empty list
 * (not an error) when GOOGLE_PLACES_API_KEY is missing so callers keep working.
 */
async function nearbySearch(
  input: z.infer<typeof nearbyInput>
): Promise<{ places: NearbyPlace[]; degraded: boolean }> {
  const key = optionalEnv("GOOGLE_PLACES_API_KEY");
  if (!key) return { places: [], degraded: true };

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.rating",
          "places.userRatingCount",
          "places.priceLevel",
          "places.websiteUri",
          "places.nationalPhoneNumber",
          "places.types",
        ].join(","),
      },
      body: JSON.stringify({
        maxResultCount: input.maxResults,
        ...(input.includedType ? { includedTypes: [input.includedType] } : {}),
        locationRestriction: {
          circle: {
            center: { latitude: input.lat, longitude: input.lng },
            radius: input.radiusMeters,
          },
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { places: [], degraded: false };

    const data = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
        websiteUri?: string;
        nationalPhoneNumber?: string;
        types?: string[];
      }[];
    };

    const places: NearbyPlace[] = (data.places ?? []).map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "Unknown",
      address: p.formattedAddress,
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      rating: p.rating,
      reviewCount: p.userRatingCount,
      priceLevel: p.priceLevel ? PRICE_LEVEL_MAP[p.priceLevel] : undefined,
      website: p.websiteUri,
      phone: p.nationalPhoneNumber,
      types: p.types,
    }));
    return { places, degraded: false };
  } catch {
    return { places: [], degraded: false };
  }
}

export const placesTools: McpTool[] = [
  {
    name: "places.nearbySearch",
    description:
      "Find nearby businesses (competitors) around a lat/lng within a radius. Read-only.",
    sideEffect: false,
    riskLevel: "low",
    inputSchema: nearbyInput,
    run: (input) => nearbySearch(input as z.infer<typeof nearbyInput>),
  },
];

export { nearbySearch, nearbyInput };
