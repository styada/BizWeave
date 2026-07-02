/**
 * Phase T.2: Build-site workflow.
 *
 * Wraps the existing 6-step Bizweave pipeline in a Temporal workflow. Each
 * step is a Temporal activity that calls the corresponding function in
 * src/lib/agents/orchestrator.ts. The workflow adds:
 *   - Durable retry on each step (3 attempts, exponential backoff)
 *   - Per-step timeout (5 min default)
 *   - Heartbeat for long-running activities
 *   - Workflow history visible in Temporal Web
 *
 * This is the "Phase T.2" entry point. The existing runAgentPipeline()
 * path is unchanged and remains the default; this workflow is opt-in via
 * the FEATURE_TEMPORAL flag in src/lib/agents/pipeline/index.ts.
 */
import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "../activities/buildSite";

// Retry policy: 3 attempts, exponential backoff starting at 1s, capped at 1m.
const { intake, plan, build, marketing, support, safeguard, publish } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "5 minutes",
    retry: {
      initialInterval: "1s",
      backoffCoefficient: 2.0,
      maximumAttempts: 3,
      maximumInterval: "1 minute",
    },
  });

export type BuildSiteInput = {
  businessId: string;
  userId: string;
  taskExecutionId?: string;
};

export type BuildSiteResult = {
  status: "live" | "needs_approval" | "failed";
  runId: string;
  approved: boolean;
  reliabilityIndex?: number;
};

/**
 * The 6-step build-site workflow. Mirrors runAgentPipeline() but durable.
 *
 * Order: intake -> plan -> build -> marketing -> support -> safeguard -> (publish?)
 * Steps 1-5 run in sequence. Step 6 (safeguard) decides whether to publish.
 */
export async function buildSiteWorkflow(
  input: BuildSiteInput
): Promise<BuildSiteResult> {
  const ctx = { ...input };

  // Steps 1-5: each is a Temporal activity, individually retried on failure.
  const intakeResult = await intake(ctx);
  if (!intakeResult.ok) {
    throw ApplicationFailure.nonRetryable("intake_failed", "INTAKE_FAILED", {
      reason: intakeResult.reason,
    });
  }

  await plan(ctx);
  await build(ctx);
  await marketing(ctx);
  await support(ctx);

  // Safeguard: decides publish vs review.
  const safeguardResult = await safeguard(ctx);

  if (safeguardResult.approved && !safeguardResult.needsApproval) {
    // Auto-publish for high-confidence runs.
    await publish(ctx);
    return {
      status: "live",
      runId: safeguardResult.runId,
      approved: true,
      reliabilityIndex: safeguardResult.reliabilityIndex,
    };
  }

  // Awaiting owner approval. In a future commit, this is a Signal the
  // workflow waits for; for now we exit with the awaiting state and the
  // owner resumes via the chat "publish my site" intent.
  return {
    status: "needs_approval",
    runId: safeguardResult.runId,
    approved: safeguardResult.approved,
    reliabilityIndex: safeguardResult.reliabilityIndex,
  };
}
