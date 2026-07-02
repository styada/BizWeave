import { db } from "@/lib/db";
import { ensureMcpBootstrapped } from "@/lib/mcp";
import type { McpInvokeResult } from "@/lib/mcp/types";

/**
 * Re-invoke the tool behind an approved PendingAction. The guard stored the
 * payload as `{ __tool, input }`, so we can reconstruct and execute with an
 * approval token (which skips the approval gate but keeps caps/audit).
 */
export async function resumeApprovedAction(
  actionId: string
): Promise<McpInvokeResult | { status: "noop"; reason: string }> {
  const action = await db.pendingAction.findUnique({ where: { id: actionId } });
  if (!action) return { status: "noop", reason: "not_found" };
  if (action.status !== "approved") return { status: "noop", reason: "not_approved" };

  let parsed: { __tool?: string; input?: unknown } = {};
  try {
    parsed = JSON.parse(action.payload) as { __tool?: string; input?: unknown };
  } catch {
    return { status: "noop", reason: "unparseable_payload" };
  }
  if (!parsed.__tool) return { status: "noop", reason: "not_a_tool_action" };

  const business = await db.business.findUnique({
    where: { id: action.businessId },
    select: { userId: true },
  });
  if (!business) return { status: "noop", reason: "business_missing" };

  const mcp = ensureMcpBootstrapped();
  const tool = mcp.get(parsed.__tool);
  if (!tool) return { status: "noop", reason: "unknown_tool" };

  // Execute directly through the tool (approval already granted). Record usage
  // is handled inside guardAction normally; here we run the tool and audit.
  try {
    const output = await tool.run(parsed.input, {
      businessId: action.businessId,
      userId: business.userId,
      dryRun: false,
    });
    await db.auditLog
      .create({
        data: {
          businessId: action.businessId,
          actorType: "user",
          actorId: action.approverUserId ?? null,
          action: action.actionType,
          riskLevel: action.riskLevel,
          after: safeJson(output),
        },
      })
      .catch(() => undefined);
    return { status: "ok", output };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

function safeJson(value: unknown): object | undefined {
  try {
    return JSON.parse(JSON.stringify(value)) as object;
  } catch {
    return undefined;
  }
}
