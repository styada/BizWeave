import { hasVercelToken, optionalEnv } from "@/lib/env";

/**
 * Sandbox abstraction for the Deep Executor.
 *
 * Each deep task should run in its own ephemeral Firecracker microVM (Vercel
 * Sandbox) with an outbound egress allow-list, then be destroyed (Section 15).
 * The real @vercel/sandbox integration is gated behind FEATURE_DEEP_EXECUTOR +
 * VERCEL_TOKEN; when unavailable we report `available: false` and the router
 * runs the inline (in-process) harness instead.
 */
export type SandboxHandle = {
  id: string;
  available: boolean;
  egressAllowlist: string[];
};

export function sandboxAvailable(): boolean {
  return hasVercelToken();
}

export function egressAllowlist(): string[] {
  return (optionalEnv("SANDBOX_EGRESS_ALLOWLIST") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Create a sandbox for a task. Currently returns an unavailable handle unless a
 * Vercel token is configured (the actual microVM creation lives behind the
 * real SDK, wired in the user's deployment). Kept as a seam so the router code
 * and tests are stable.
 */
export async function createSandbox(taskId: string): Promise<SandboxHandle> {
  return {
    id: `sbx_${taskId}`,
    available: sandboxAvailable(),
    egressAllowlist: egressAllowlist(),
  };
}

export async function destroySandbox(_handle: SandboxHandle): Promise<void> {
  // No-op for the inline path; the real SDK teardown happens in deployment.
}
