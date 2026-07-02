import { db } from "@/lib/db";
import { redactSecrets } from "@/lib/security/sanitize";

const MIN_REWARD = 0.7;
const MIN_RUNS = 3;

/**
 * Fleet-learning pipeline: promote high-performing, PII-scrubbed skills from
 * per-business memory into the global SkillLibrary (dogfood loop, Section 9).
 */
export async function promoteSkillsToLibrary(opts?: {
  businessId?: string;
  autoApprove?: boolean;
}): Promise<{ proposed: number; approved: number }> {
  const skills = await db.skill.findMany({
    where: {
      scope: "business",
      businessId: opts?.businessId,
      rewardScore: { gte: MIN_REWARD },
      runCount: { gte: MIN_RUNS },
    },
    take: 50,
  });

  let proposed = 0;
  let approved = 0;

  for (const skill of skills) {
    const exists = await db.skillPromotion.findFirst({
      where: { sourceSkillId: skill.id, status: { in: ["proposed", "approved"] } },
    });
    if (exists) continue;

    const scrubbed = scrubSkillDefinition(skill.definition);
    const lib = await db.skillLibrary.upsert({
      where: { name: skill.name },
      create: {
        name: skill.name,
        description: skill.description ?? undefined,
        definition: scrubbed,
        category: "promoted",
        avgReward: skill.rewardScore,
      },
      update: {
        avgReward: skill.rewardScore,
        definition: scrubbed,
      },
    });

    const promotion = await db.skillPromotion.create({
      data: {
        skillLibraryId: lib.id,
        sourceSkillId: skill.id,
        sourceBusinessId: skill.businessId,
        status: opts?.autoApprove ? "approved" : "proposed",
        piiScrubbed: true,
      },
    });
    proposed += 1;
    if (promotion.status === "approved") approved += 1;
  }

  return { proposed, approved };
}

function scrubSkillDefinition(def: unknown): object {
  const raw = JSON.stringify(def ?? {});
  const scrubbed = redactSecrets(raw);
  try {
    return JSON.parse(scrubbed) as object;
  } catch {
    return { steps: [] };
  }
}
