import { db } from "@/lib/db";
import { embed, toVectorLiteral } from "@/lib/memory/embeddings";

export type MatchedSkill = {
  id: string;
  name: string;
  description: string | null;
  definition: unknown;
  score: number;
};

const MATCH_THRESHOLD = 0.72;

/**
 * Retrieval-first skill match: find an existing playbook before planning from
 * scratch (Phase 20). Falls back to null when confidence is low.
 */
export async function matchSkill(params: {
  businessId: string;
  goal: string;
  userId: string;
}): Promise<MatchedSkill | null> {
  const vector = await embed(params.goal, params.userId);

  if (vector) {
    const literal = toVectorLiteral(vector);
    const rows = await db.$queryRaw<
      { id: string; name: string; description: string | null; definition: unknown; score: number }[]
    >`
      SELECT id, name, description, definition,
             1 - (embedding <=> ${literal}::vector) AS score
      FROM "Skill"
      WHERE ("businessId" = ${params.businessId} OR scope = 'global')
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${literal}::vector
      LIMIT 3
    `;
    const best = rows[0];
    if (best && best.score >= MATCH_THRESHOLD) return best;
  }

  // Keyword fallback when embeddings unavailable.
  const keywords = params.goal.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  if (keywords.length === 0) return null;

  const skills = await db.skill.findMany({
    where: {
      OR: [{ businessId: params.businessId }, { scope: "global" }],
    },
    orderBy: { rewardScore: "desc" },
    take: 20,
  });

  let best: (typeof skills)[0] | null = null;
  let bestScore = 0;
  for (const s of skills) {
    const hay = `${s.name} ${s.description ?? ""}`.toLowerCase();
    const hits = keywords.filter((k) => hay.includes(k)).length;
    const score = hits / keywords.length;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (!best || bestScore < 0.4) return null;
  return { ...best, score: bestScore };
}
