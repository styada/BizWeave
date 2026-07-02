import type { UsageKind } from "@/lib/usage/meter";

export type RiskLevel = "low" | "medium" | "high";

export type GuardedActionInput = {
  businessId: string;
  userId: string;
  actionType: string; // matches ApprovalPolicy.actionType
  riskLevel: RiskLevel;
  payload: unknown;
  estCostUsd?: number;
  vendor?: string; // for purchases -> ProcurementPolicy
  usageKind?: UsageKind; // metered dimension, if any
  usageQuantity?: number; // amount of the metered dimension
  execute: () => Promise<unknown>;
  dryRun?: boolean;
  /** Set when re-invoked after a PendingAction was approved. */
  approvedActionId?: string;
};

export type GuardedActionResult =
  | { status: "executed"; result: unknown }
  | { status: "needs_approval"; pendingActionId: string }
  | { status: "dry_run"; preview: unknown }
  | { status: "blocked"; reason: string };
