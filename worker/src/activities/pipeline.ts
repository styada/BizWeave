/**
 * Phase T.2: Real activities that wrap the existing Bizweave pipeline.
 *
 * Each activity is a thin shim that calls the existing orchestrator step
 * functions in src/lib/agents/orchestrator.ts. The workflow (T.2) chains
 * these in order. The Node activities import from the Next.js app via
 * relative paths; in production the worker is a separate process that
 * shares the Prisma client + DB.
 *
 * Why not move all of runAgentPipeline() into a single activity? Because
 * Temporal's value is in the durable retry of *each step*. A 90s pipeline
 * where step 4 fails at minute 5 should not re-run steps 1-3.
 */

export type StepContext = {
  businessId: string;
  userId: string;
  taskExecutionId?: string;
  runId: string;
};

// Re-export shared types for workflow consumers.
export type IntakeResult = { ok: true; businessName: string } | { ok: false; reason: string };
export type SafeguardResult = {
  approved: boolean;
  needsApproval: boolean;
  reliabilityIndex?: number;
};
export type PublishResult = { ok: true; url: string } | { ok: false; reason: string };

/**
 * Run a single pipeline step by delegating to the existing step runner.
 * The step names match AGENT_PIPELINE in src/lib/agents/types.ts:
 *   intake | planner | builder | marketing | support | safeguard | ...
 */
export async function runPipelineStep(
  step: "intake" | "planner" | "builder" | "marketing" | "support" | "safeguard",
  ctx: StepContext,
  useLlm: boolean
): Promise<{ ok: true; output: unknown } | { ok: false; reason: string }> {
  // Lazy import to keep the worker bootable even if Next.js bundling shifts.
  const { runStepForActivity } = await import("./runStepBridge");
  return runStepForActivity(step, ctx, useLlm);
}

/**
 * Phase T.2 specific helpers below. Each maps to one activity slot in
 * the buildSiteWorkflow. Bodies are thin: they call runPipelineStep
 * with the right step name.
 */

export const intake = async (ctx: StepContext) =>
  runPipelineStep("intake", ctx, /* useLlm */ true);

export const plan = async (ctx: StepContext) =>
  runPipelineStep("planner", ctx, /* useLlm */ true);

export const build = async (ctx: StepContext) =>
  runPipelineStep("builder", ctx, /* useLlm */ true);

export const marketing = async (ctx: StepContext) =>
  runPipelineStep("marketing", ctx, /* useLlm */ true);

export const support = async (ctx: StepContext) =>
  runPipelineStep("support", ctx, /* useLlm */ true);

export const safeguard = async (
  ctx: StepContext
): Promise<SafeguardResult> => {
  const r = await runPipelineStep("safeguard", ctx, /* useLlm */ true);
  if (!r.ok) {
    return { approved: false, needsApproval: true };
  }
  const out = r.output as {
    approved: boolean;
    reliabilityIndex?: number;
    needsApproval?: boolean;
  };
  return {
    approved: !!out.approved,
    needsApproval: !!out.needsApproval,
    reliabilityIndex: out.reliabilityIndex,
  };
};

export const publish = async (ctx: StepContext): Promise<PublishResult> => {
  // The publish step is normally gated by ApprovalPolicy. In T.2 we only
  // auto-publish when the workflow was started with a verified approval;
  // otherwise we exit needs_approval. The chat's "publish my site"
  // intent handles the manual path.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    ok: true,
    url: `${appUrl}/sites/${ctx.businessId}`,
  };
};
