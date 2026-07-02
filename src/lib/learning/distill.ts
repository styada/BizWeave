import { db } from "@/lib/db";
import { embed, toVectorLiteral } from "@/lib/memory/embeddings";
import { redactSecrets } from "@/lib/security/sanitize";

export type SkillDefinition = {
  name: string;
  description: string;
  steps: { action: string; tool?: string; params?: Record<string, unknown> }[];
  tags?: string[];
};

/**
 * Distill a successful task into a reusable Skill playbook (agentskills.io
 * compatible). Called after verified completion so the operator gets smarter.
 */
export async function distillSkill(params: {
  businessId: string;
  name: string;
  goal: string;
  steps: SkillDefinition["steps"];
  userId: string;
}): Promise<{ skillId: string }> {
  const definition: SkillDefinition = {
    name: params.name,
    description: params.goal,
    steps: params.steps,
    tags: inferTags(params.goal),
  };

  const scrubbed = JSON.parse(redactSecrets(JSON.stringify(definition))) as SkillDefinition;
  const text = `${scrubbed.name}: ${scrubbed.description} ${scrubbed.steps.map((s) => s.action).join(" ")}`;
  const vector = await embed(text, params.userId);

  const skill = await db.skill.create({
    data: {
      businessId: params.businessId,
      name: scrubbed.name.slice(0, 120),
      description: scrubbed.description.slice(0, 500),
      definition: scrubbed as unknown as object,
      scope: "business",
      rewardScore: 0.5,
    },
  });

  if (vector) {
    await db.$executeRawUnsafe(
      `UPDATE "Skill" SET embedding = $1::vector WHERE id = $2`,
      toVectorLiteral(vector),
      skill.id
    ).catch(() => undefined);
  }

  return { skillId: skill.id };
}

function inferTags(goal: string): string[] {
  const g = goal.toLowerCase();
  const tags: string[] = [];
  if (/site|website/.test(g)) tags.push("site");
  if (/ad|campaign/.test(g)) tags.push("ads");
  if (/receptionist|voice/.test(g)) tags.push("voice");
  if (/email|sms|outreach/.test(g)) tags.push("outreach");
  if (/competitor/.test(g)) tags.push("research");
  return tags;
}
