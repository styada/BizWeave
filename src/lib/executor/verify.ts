import { db } from "@/lib/db";
import type { AgentTaskResult } from "@/lib/types/agent-task";

export type VerificationResult = { verified: boolean; reason?: string };

/**
 * Real-world completion verification: don't mark a task "done" until the
 * underlying artifact is actually observable in the database/tool. This closes
 * the "unreliable done signal" failure mode (Polsia). On verified failure the
 * caller should auto-refund credits.
 */
export async function verifyCompletion(params: {
  businessId: string;
  goal: string;
  result: AgentTaskResult;
}): Promise<VerificationResult> {
  const { businessId, goal, result } = params;
  if (!result.ok) return { verified: false, reason: "task_reported_failure" };

  const g = goal.toLowerCase();

  if (/website|web site|landing|site build|build.*site/.test(g)) {
    const site = await db.generatedSite.findUnique({
      where: { businessId },
      select: { html: true },
    });
    if (!site?.html || site.html.length < 200) {
      return { verified: false, reason: "no_site_html_persisted" };
    }
    return { verified: true };
  }

  if (/publish|deploy|go live/.test(g)) {
    const live = await db.deployment.findFirst({
      where: { businessId, status: "live" },
      select: { id: true },
    });
    return live ? { verified: true } : { verified: false, reason: "no_live_deployment" };
  }

  if (/receptionist|phone agent|voice/.test(g)) {
    const agent = await db.phoneAgent.findFirst({
      where: { businessId },
      select: { id: true },
    });
    return agent ? { verified: true } : { verified: false, reason: "no_phone_agent" };
  }

  // Default: trust the harness's ok flag but require a non-empty summary.
  return result.summary && result.summary.length > 0
    ? { verified: true }
    : { verified: false, reason: "empty_summary" };
}
