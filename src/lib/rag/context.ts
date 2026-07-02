import { db } from "@/lib/db";
import { retrieveMemory, memoryToPromptBlock } from "@/lib/memory/store";

export type BrandContext = {
  motto: string | null;
  voice: string | null;
  palette: Record<string, string> | null;
  logoUrl: string | null;
};

/** Load versioned brand kit for a business. */
export async function loadBrandContext(businessId: string): Promise<BrandContext | null> {
  const kit = await db.brandKit.findUnique({
    where: { businessId },
    select: { motto: true, voice: true, palette: true, logoUrl: true },
  });
  if (!kit) return null;
  return {
    motto: kit.motto,
    voice: kit.voice,
    palette: kit.palette as Record<string, string> | null,
    logoUrl: kit.logoUrl,
  };
}

/**
 * Per-business local RAG block: hybrid vector+FTS memory + brand kit, injected
 * into generators, receptionist, and operator chat.
 */
export async function buildRagContext(params: {
  businessId: string;
  query: string;
  userId?: string;
  k?: number;
}): Promise<string> {
  const [brand, memories] = await Promise.all([
    loadBrandContext(params.businessId),
    retrieveMemory({
      businessId: params.businessId,
      query: params.query,
      userId: params.userId,
      k: params.k ?? 8,
    }),
  ]);

  const parts: string[] = [];
  if (brand) {
    parts.push(
      `BRAND: motto="${brand.motto ?? ""}" voice="${brand.voice ?? ""}" colors=${JSON.stringify(brand.palette ?? {})}`
    );
  }
  if (memories.length > 0) {
    parts.push(memoryToPromptBlock(memories));
  }
  return parts.join("\n\n");
}

/** Upsert brand kit fields (version bumps on palette/logo changes). */
export async function updateBrandKit(
  businessId: string,
  data: Partial<BrandContext & { typography?: Record<string, string> }>
): Promise<void> {
  const existing = await db.brandKit.findUnique({ where: { businessId } });
  const bumpVersion =
    existing &&
    ((data.palette && JSON.stringify(data.palette) !== JSON.stringify(existing.palette)) ||
      (data.logoUrl && data.logoUrl !== existing.logoUrl));

  await db.brandKit.upsert({
    where: { businessId },
    create: {
      businessId,
      motto: data.motto ?? null,
      voice: data.voice ?? null,
      palette: data.palette ?? undefined,
      typography: data.typography ?? undefined,
      logoUrl: data.logoUrl ?? null,
    },
    update: {
      motto: data.motto ?? undefined,
      voice: data.voice ?? undefined,
      palette: data.palette ?? undefined,
      typography: data.typography ?? undefined,
      logoUrl: data.logoUrl ?? undefined,
      version: bumpVersion ? { increment: 1 } : undefined,
    },
  });
}
