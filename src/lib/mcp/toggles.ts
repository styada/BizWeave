import type { McpTool } from "@/lib/mcp/types";

/** Per-workspace MCP tool allow-list. Empty = all registered tools allowed. */
const workspaceToolToggles = new Map<string, Set<string>>();

export function setWorkspaceTools(workspaceId: string, toolNames: string[]): void {
  workspaceToolToggles.set(workspaceId, new Set(toolNames));
}

export function isToolEnabled(workspaceId: string | undefined, toolName: string): boolean {
  if (!workspaceId) return true;
  const allowed = workspaceToolToggles.get(workspaceId);
  if (!allowed || allowed.size === 0) return true;
  return allowed.has(toolName);
}

export function filterToolsForWorkspace(workspaceId: string | undefined, tools: McpTool[]): McpTool[] {
  if (!workspaceId) return tools;
  const allowed = workspaceToolToggles.get(workspaceId);
  if (!allowed || allowed.size === 0) return tools;
  return tools.filter((t) => allowed.has(t.name));
}

/** agentskills.io-compatible export format. */
export function exportSkill(definition: unknown, meta: { name: string; description?: string }) {
  return {
    schema_version: "1.0",
    name: meta.name,
    description: meta.description ?? "",
    definition,
  };
}

export function importSkill(payload: { name: string; description?: string; definition: unknown }) {
  return {
    name: payload.name,
    description: payload.description ?? null,
    definition: payload.definition as object,
    scope: "global" as const,
  };
}
