/**
 * Phase T.2: Build-site workflow with REAL activities.
 *
 * Wraps the Bizweave pipeline in a Temporal workflow. Each step is a
 * Temporal activity that calls the corresponding function in
 * src/lib/agents/orchestrator.ts. The workflow adds:
 *   - Durable retry on each step (3 attempts, exponential backoff)
 *   - Per-step timeout (5 min default)
 *   - Workflow history visible in Temporal Web
 *
 * This workflow is opt-in via the FEATURE_TEMPORAL flag in
 * src/lib/pipeline/index.ts. The existing runAgentPipeline() path is
 * unchanged and remains the default.
 */
import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "../activities/pipeline";

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

export async function buildSiteWorkflow(
  input: BuildSiteInput
): Promise<BuildSiteResult> {
  // Each step is a Temporal activity. Failures retry up to 3 times.
  const intakeResult = await intake(input);
  if (!intakeResult.ok) {
    throw ApplicationFailure.nonRetryable("intake_failed", "INTAKE_FAILED", {
      reason: intakeResult.reason,
    });
  }

  await plan(input);
  await build(input);
  await marketing(input);
  await support(input);

  const sg = await safeguard(input);

  if (sg.approved && !sg.needsApproval) {
    await publish(input);
    return {
      status: "live",
      runId: `wf-${Date.now()}`,
      approved: true,
      reliabilityIndex: sg.reliabilityIndex,
    };
  }

  return {
    status: "needs_approval",
    runId: `wf-${Date.now()}`,
    approved: sg.approved,
    reliabilityIndex: sg.reliabilityIndex,
  };
}
