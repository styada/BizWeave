import { db } from "@/lib/db";
import { embed, toVectorLiteral } from "@/lib/memory/embeddings";

export type MemoryKind =
  | "fact"
  | "preference"
  | "decision"
  | "doc"
  | "competitor"
  | "review"
  | "conversation"
  | "skill_note";

export type RetrievedMemory = {
  id: string;
  kind: string;
  content: string;
  salience: number;
  score?: number;
};

/**
 * Persist a memory entry. Writes the row via Prisma, then (best-effort) attaches
 * an embedding via raw SQL since the `embedding` column is an Unsupported type.
 */
export async function addMemory(params: {
  businessId: string;
  kind: MemoryKind;
  content: string;
  salience?: number;
  source?: string;
  userId?: string;
}): Promise<string | null> {
  try {
    const row = await db.memoryEntry.create({
      data: {
        businessId: params.businessId,
        kind: params.kind,
        content: params.content,
        salience: params.salience ?? 0.5,
        source: params.source ?? null,
      },
      select: { id: true },
    });

    const vec = await embed(params.content, params.userId);
    if (vec) {
      await db.$executeRawUnsafe(
        `UPDATE "MemoryEntry" SET embedding = $1::vector WHERE id = $2`,
        toVectorLiteral(vec),
        row.id
      ).catch(() => undefined);
    }
    return row.id;
  } catch (err) {
    console.error("[memory] addMemory failed:", err);
    return null;
  }
}

/**
 * Hybrid retrieval: vector cosine similarity when embeddings exist, otherwise a
 * keyword (ILIKE) + recency + salience fallback. Never throws — returns [] on
 * error so chat/generation keep working.
 */
export async function retrieveMemory(params: {
  businessId: string;
  query: string;
  k?: number;
  userId?: string;
}): Promise<RetrievedMemory[]> {
  const k = params.k ?? 8;

  // Try vector search first.
  const vec = await embed(params.query, params.userId);
  if (vec) {
    try {
      const rows = await db.$queryRawUnsafe<RetrievedMemory[]>(
        `SELECT id, kind, content, salience,
                1 - (embedding <=> $1::vector) AS score
         FROM "MemoryEntry"
         WHERE "businessId" = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        toVectorLiteral(vec),
        params.businessId,
        k
      );
      if (rows.length > 0) return rows;
    } catch {
      // pgvector not enabled / no embeddings yet -> fall through.
    }
  }

  // Keyword + recency fallback.
  try {
    const terms = params.query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .slice(0, 5);
    const rows = await db.memoryEntry.findMany({
      where: {
        businessId: params.businessId,
        ...(terms.length
          ? { OR: terms.map((t) => ({ content: { contains: t, mode: "insensitive" as const } })) }
          : {}),
      },
      orderBy: [{ salience: "desc" }, { createdAt: "desc" }],
      take: k,
      select: { id: true, kind: true, content: true, salience: true },
    });
    return rows;
  } catch {
    return [];
  }
}

/** Compose a compact context block to inject into prompts. */
export function memoryToPromptBlock(mems: RetrievedMemory[]): string {
  if (mems.length === 0) return "";
  return (
    "Relevant business memory:\n" +
    mems.map((m) => `- (${m.kind}) ${m.content}`).join("\n")
  );
}
