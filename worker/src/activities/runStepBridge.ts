/**
 * Bridge between Temporal activities and the Bizweave Next.js pipeline.
 *
 * The worker is a separate Node process. It needs to invoke the same
 * pipeline steps the chat/orchestrator use. Rather than duplicate the
 * logic, we call the orchestrator's runAgentPipeline and tag the
 * activity result with the step we're after.
 *
 * In T.2 we run the entire pipeline once and return the per-step
 * output. This is not optimal (re-runs all steps each time) but it's
 * correct and lets us ship the workflow shape immediately.
 */
import { runAgentPipeline } from "@/lib/agents/orchestrator";

export type PipelineStep =
  | "intake"
  | "planner"
  | "builder"
  | "marketing"
  | "support"
  | "safeguard";

export async function runStepForActivity(
  step: PipelineStep,
  ctx: { businessId: string; userId: string; taskExecutionId?: string; runId: string },
  useLlm: boolean
): Promise<{ ok: true; output: unknown } | { ok: false; reason: string }> {
  try {
    const result = await runAgentPipeline(ctx.businessId, ctx.userId, {
      taskExecutionId: ctx.taskExecutionId,
    });
    if (step === "safeguard") {
      return {
        ok: true,
        output: {
          approved: result.approved,
          needsApproval: result.needsApproval,
          reliabilityIndex: 0,
        },
      };
    }
    return {
      ok: true,
      output: { runId: result.runId, approved: result.approved, useLlm },
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
