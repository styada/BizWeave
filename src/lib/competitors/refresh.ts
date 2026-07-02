import { db } from "@/lib/db";
import { ensureMcpBootstrapped } from "@/lib/mcp";
import type { NearbyPlace } from "@/lib/mcp/servers/places";
import { embed, toVectorLiteral } from "@/lib/memory/embeddings";
import { addMemory } from "@/lib/memory/store";

/** Map Bizweave business types to Google Places includedType + search radius. */
const TYPE_MAP: Record<string, { placeType?: string; radius: number }> = {
  "retail-liquor": { placeType: "liquor_store", radius: 5000 },
  "retail-general": { placeType: "store", radius: 4000 },
  restaurant: { placeType: "restaurant", radius: 3000 },
  cafe: { placeType: "cafe", radius: 2500 },
  "salon-barber": { placeType: "hair_salon", radius: 4000 },
  "gym-fitness": { placeType: "gym", radius: 6000 },
  trades: { placeType: "plumber", radius: 15000 },
  "clinic-health": { placeType: "doctor", radius: 8000 },
  "auto-shop": { placeType: "car_repair", radius: 8000 },
  services: { placeType: undefined, radius: 10000 },
  other: { placeType: undefined, radius: 5000 },
};

export type RefreshResult = {
  ok: boolean;
  found: number;
  upserted: number;
  degraded?: string;
};

/**
 * Refresh the competitor set for a business: Places nearby search around its
 * geocoded location, upsert Competitor rows (dedup by placeId), embed each for
 * later retrieval, and write a summary MemoryEntry the operator can recall.
 */
export async function refreshCompetitors(
  businessId: string,
  userId?: string
): Promise<RefreshResult> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, type: true, lat: true, lng: true, userId: true },
  });
  if (!business) return { ok: false, found: 0, upserted: 0, degraded: "not_found" };
  if (business.lat == null || business.lng == null) {
    return { ok: false, found: 0, upserted: 0, degraded: "no_coordinates" };
  }

  const cfg = TYPE_MAP[business.type] ?? TYPE_MAP.other;
  const mcp = ensureMcpBootstrapped();
  const res = await mcp.invoke<{ places: NearbyPlace[]; degraded: boolean }>(
    "places.nearbySearch",
    { lat: business.lat, lng: business.lng, radiusMeters: cfg.radius, includedType: cfg.placeType },
    { businessId, userId: business.userId, dryRun: false }
  );

  if (res.status !== "ok") {
    return { ok: false, found: 0, upserted: 0, degraded: "search_failed" };
  }
  const places = res.output.places.filter((p) => p.placeId);
  if (res.output.degraded) {
    return { ok: false, found: 0, upserted: 0, degraded: "no_places_key" };
  }

  let upserted = 0;
  for (const p of places) {
    try {
      const row = await db.competitor.upsert({
        where: { businessId_placeId: { businessId, placeId: p.placeId } },
        create: {
          businessId,
          placeId: p.placeId,
          name: p.name,
          address: p.address ?? null,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          rating: p.rating ?? null,
          reviewCount: p.reviewCount ?? null,
          priceLevel: p.priceLevel ?? null,
          website: p.website ?? null,
          phone: p.phone ?? null,
          categories: p.types ?? undefined,
          lastSeenAt: new Date(),
        },
        update: {
          name: p.name,
          rating: p.rating ?? null,
          reviewCount: p.reviewCount ?? null,
          website: p.website ?? null,
          lastSeenAt: new Date(),
        },
        select: { id: true },
      });
      upserted += 1;

      const vec = await embed(
        `${p.name}. ${p.address ?? ""}. rating ${p.rating ?? "?"} (${p.reviewCount ?? 0} reviews).`,
        userId
      );
      if (vec) {
        await db.$executeRawUnsafe(
          `UPDATE "Competitor" SET embedding = $1::vector WHERE id = $2`,
          toVectorLiteral(vec),
          row.id
        ).catch(() => undefined);
      }
    } catch {
      // skip individual failures
    }
  }

  // Summarize into memory for the operator/generators to recall.
  const top = [...places]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5)
    .map((p) => `${p.name} (${p.rating ?? "?"}★, ${p.reviewCount ?? 0} reviews)`)
    .join("; ");
  if (top) {
    void addMemory({
      businessId,
      kind: "competitor",
      content: `Top nearby competitors: ${top}.`,
      salience: 0.7,
      source: "places",
      userId,
    });
  }

  return { ok: true, found: places.length, upserted };
}
