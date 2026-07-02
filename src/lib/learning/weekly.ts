import { db } from "@/lib/db";
import { runDreamingCycle } from "@/lib/dreaming/cycle";
import { promoteSkillsToLibrary } from "@/lib/learning/promote";
import { scoreTaskOutcome } from "@/lib/learning/evaluate";

/**
 * Phase I: weekly "while you slept" reflection.
 *
 * - Score recent successful tasks against real KPIs
 * - Promote high-reward, well-tested skills into the global library
 * - Run the dreaming cycle to generate the morning brief
 *
 * Returns a structured summary that can be surfaced in the dashboard
 * or used by the chat to give the owner a weekly recap.
 */
export type WeeklyResult = {
  businessId: string;
  userId: string;
  tasksScored: number;
  skillsPromoted: number;
  dreamsRun: number;
  briefExcerpt: string;
};

export async function runWeeklyReflection(
  businessId: string,
  userId: string
): Promise<WeeklyResult> {
  // 1. Score the last 7 days of successful agent tasks.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentTasks = await db.agentTask.findMany({
    where: {
      businessId,
      status: "done",
      completedAt: { gte: sevenDaysAgo },
    },
    select: { id: true, title: true },
    take: 50,
  });

  let tasksScored = 0;
  for (const task of recentTasks) {
    await scoreTaskOutcome({ businessId, taskId: task.id, intent: task.title }).catch(
      () => undefined
    );
    tasksScored += 1;
  }

  // 2. Promote high-reward skills to the global library.
  const promotion = await promoteSkillsToLibrary({ businessId, autoApprove: false });

  // 3. Run the dreaming cycle for the morning brief.
  const dream = await runDreamingCycle(businessId, userId);

  // 4. Emit a single activity event summarizing the week.
  await db.activityEvent
    .create({
      data: {
        businessId,
        eventType: "weekly_reflection",
        level: "info",
        message: `Weekly recap: ${tasksScored} tasks scored, ${promotion.proposed} skills proposed for library.`,
        payload: JSON.stringify({
          tasksScored,
          skillsPromoted: promotion.proposed,
          mood: dream.mood,
        }),
      },
    })
    .catch(() => undefined);

  return {
    businessId,
    userId,
    tasksScored,
    skillsPromoted: promotion.proposed,
    dreamsRun: 1,
    briefExcerpt: dream.brief.slice(0, 240),
  };
}
