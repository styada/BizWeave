export type AgentTaskSpec = {
  goal: string; // natural-language objective
  inputs?: Record<string, unknown>;
  tools?: string[]; // MCP tool names the task may use
  constraints?: string[];
  budgetUsd?: number; // hard cap; default from tier
  requiresApproval?: boolean; // side-effectful -> true
  dryRun?: boolean;
};

export type AgentTaskArtifact = {
  kind: string;
  url?: string;
  value?: string;
};

export type AgentTaskResult = {
  ok: boolean;
  summary: string;
  artifacts?: AgentTaskArtifact[];
  costUsd: number;
  skillLearned?: string; // Skill.id if distilled
};
