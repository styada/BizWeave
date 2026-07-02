/**
 * Activities for the buildSiteWorkflow. Each activity is a thin wrapper
 * around the corresponding step in src/lib/agents/orchestrator.ts.
 *
 * Activities run in the worker process (Node 22), not the workflow
 * orchestrator. The workflow code is deterministic; only activities
 * touch the DB, call LLM APIs, or do I/O.
 *
 * These are stubs in Phase T.1. Phase T.2 will replace them with real
 * calls to the orchestrator's step functions.
 */

export type StepContext = {
  businessId: string;
  userId: string;
  taskExecutionId?: string;
};

export type IntakeResult = { ok: true; businessName: string } | { ok: false; reason: string };

export const intake = async (_ctx: StepContext): Promise<IntakeResult> => {
  // Stub: real implementation calls the existing orchestrator's intake step.
  return { ok: true, businessName: "Test Business" };
};

export const plan = async (_ctx: StepContext): Promise<{ ok: true }> => {
  return { ok: true };
};

export const build = async (_ctx: StepContext): Promise<{ ok: true; siteId?: string }> => {
  return { ok: true };
};

export const marketing = async (_ctx: StepContext): Promise<{ ok: true }> => {
  return { ok: true };
};

export const support = async (_ctx: StepContext): Promise<{ ok: true }> => {
  return { ok: true };
};

export type SafeguardResult = {
  approved: boolean;
  needsApproval: boolean;
  runId: string;
  reliabilityIndex?: number;
};

export const safeguard = async (_ctx: StepContext): Promise<SafeguardResult> => {
  return {
    approved: true,
    needsApproval: false,
    runId: "stub-run",
    reliabilityIndex: 85,
  };
};

export const publish = async (_ctx: StepContext): Promise<{ ok: true; url: string }> => {
  return { ok: true, url: "https://example.com" };
};
