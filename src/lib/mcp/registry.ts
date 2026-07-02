import type { McpContext, McpInvokeResult, McpTool } from "@/lib/mcp/types";
import { guardAction } from "@/lib/guard/guard";
import { isToolEnabled } from "@/lib/mcp/toggles";
import { db } from "@/lib/db";

/**
 * The MCP tool bus. Every capability domain registers its tools here; every
 * harness (chat, pipeline, deep executor) invokes through `invoke()` so that
 * validation + guardrails are applied uniformly.
 */
class McpRegistry {
  private tools = new Map<string, McpTool>();

  register(tool: McpTool): void {
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: McpTool[]): void {
    for (const t of tools) this.register(t);
  }

  get(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  list(): McpTool[] {
    return Array.from(this.tools.values());
  }

  /** Tool descriptors for exposing to LLM harnesses. */
  describe(): { name: string; description: string; sideEffect: boolean }[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      sideEffect: t.sideEffect,
    }));
  }

  async invoke<O = unknown>(
    name: string,
    rawInput: unknown,
    ctx: McpContext
  ): Promise<McpInvokeResult<O>> {
    const tool = this.tools.get(name);
    if (!tool) return { status: "error", error: `Unknown tool: ${name}` };

    const parsed = tool.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        status: "error",
        error: parsed.error.issues[0]?.message ?? "Invalid tool input",
      };
    }
    const input = parsed.data;

    const business = await db.business.findUnique({
      where: { id: ctx.businessId },
      select: { workspaceId: true },
    });
    if (!isToolEnabled(business?.workspaceId ?? undefined, name)) {
      return { status: "blocked", reason: `Tool ${name} is disabled for this workspace` };
    }

    // Read-only tools run directly.
    if (!tool.sideEffect) {
      try {
        const output = (await tool.run(input, ctx)) as O;
        return { status: "ok", output };
      } catch (err) {
        return { status: "error", error: asMessage(err) };
      }
    }

    // Side-effecting tools go through the guardrail wrapper.
    const est = tool.estimate?.(input) ?? {};
    const guarded = await guardAction({
      businessId: ctx.businessId,
      userId: ctx.userId,
      actionType: tool.actionType ?? tool.name,
      riskLevel: tool.riskLevel,
      payload: { __tool: tool.name, input },
      estCostUsd: est.costUsd,
      vendor: est.vendor,
      usageKind: tool.usageKind,
      usageQuantity: est.quantity,
      dryRun: ctx.dryRun,
      execute: () => tool.run(input, ctx),
    });

    switch (guarded.status) {
      case "executed":
        return { status: "ok", output: guarded.result as O };
      case "needs_approval":
        return { status: "needs_approval", pendingActionId: guarded.pendingActionId };
      case "dry_run":
        return { status: "dry_run", preview: guarded.preview };
      case "blocked":
        return { status: "blocked", reason: guarded.reason };
    }
  }
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const mcp = new McpRegistry();
