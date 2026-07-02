import type { ZodType } from "zod";
import type { RiskLevel } from "@/lib/guard/types";
import type { UsageKind } from "@/lib/usage/meter";

export type McpContext = {
  businessId: string;
  userId: string;
  dryRun: boolean;
};

export type McpTool<I = unknown, O = unknown> = {
  name: string; // e.g. "places.nearbySearch"
  description: string;
  sideEffect: boolean; // true -> must go through guardAction
  riskLevel: RiskLevel;
  /** ApprovalPolicy.actionType this tool maps to (defaults to `name`). */
  actionType?: string;
  /** Metered dimension, if the tool consumes a quota. */
  usageKind?: UsageKind;
  inputSchema: ZodType<I>;
  run: (input: I, ctx: McpContext) => Promise<O>;
  /** Estimate the USD cost + metered quantity for a given input (for caps). */
  estimate?: (input: I) => { costUsd?: number; quantity?: number; vendor?: string };
};

export type McpInvokeResult<O = unknown> =
  | { status: "ok"; output: O }
  | { status: "needs_approval"; pendingActionId: string }
  | { status: "dry_run"; preview: unknown }
  | { status: "blocked"; reason: string }
  | { status: "error"; error: string };
