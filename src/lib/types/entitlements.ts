export type Tier = "free" | "starter400" | "growth600" | "operator1500";

export type Entitlements = {
  tier: Tier;
  agentTaskMinutes: number; // platform compute
  llmCreditsUsd: number; // included platform LLM spend
  sandboxHours: number;
  emails: number;
  sms: number;
  voiceMinutes: number;
  managedAdSpendUsd: number; // ceiling on customer-funded ad spend we manage
  sites: number;
  domains: number;
  connectors: number;
  seats: number;
};
