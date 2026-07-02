"use client";

import { AGENT_LABELS, AGENT_PIPELINE, type AgentId } from "@/lib/agents/types";
import { cn } from "@/lib/utils";
import {
  Brain,
  Hammer,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  ClipboardList,
  Check,
  Loader2,
  Send,
  Target,
  LineChart,
  Search,
  Workflow,
} from "lucide-react";

const AGENT_ICONS: Record<AgentId, typeof Brain> = {
  intake: ClipboardList,
  planner: Brain,
  builder: Hammer,
  marketing: Megaphone,
  support: MessageCircle,
  safeguard: ShieldCheck,
  outreach: Send,
  ads: Target,
  finance: LineChart,
  "competitor-research": Search,
  orchestrator: Workflow,
};

type StepStatus = "pending" | "running" | "complete" | "failed";

export function AgentPipeline({
  currentStep,
  completedSteps = [],
  failedStep,
}: {
  currentStep?: string | null;
  completedSteps?: string[];
  failedStep?: string | null;
}) {
  function getStatus(agent: AgentId): StepStatus {
    if (failedStep === agent) return "failed";
    if (completedSteps.includes(agent)) return "complete";
    if (currentStep === agent) return "running";
    const currentIdx = AGENT_PIPELINE.indexOf(currentStep as AgentId);
    const agentIdx = AGENT_PIPELINE.indexOf(agent);
    if (currentIdx >= 0 && agentIdx < currentIdx) return "complete";
    return "pending";
  }

  return (
    <ol className="space-y-3" aria-label="Agent pipeline progress">
      {AGENT_PIPELINE.map((agent, i) => {
        const status = getStatus(agent);
        const Icon = AGENT_ICONS[agent];
        const isSafeguard = agent === "safeguard";

        return (
          <li
            key={agent}
            className={cn(
              "flex items-center gap-4 rounded-xl border p-4 transition-all duration-300",
              status === "running" && "border-accent-primary/40 bg-accent-primary/5",
              status === "complete" && "border-success/20 bg-success/5",
              status === "failed" && "border-error/30 bg-error/5",
              status === "pending" && "border-white/5 bg-white/[0.02]",
              isSafeguard && status !== "pending" && "border-safeguard/30"
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                status === "running" && "bg-accent-primary/20 text-accent-primary",
                status === "complete" && "bg-success/20 text-success",
                status === "failed" && "bg-error/20 text-error",
                status === "pending" && "bg-bg-muted text-text-muted",
                isSafeguard && "bg-safeguard/20 text-safeguard"
              )}
            >
              {status === "running" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : status === "complete" ? (
                <Check className="h-5 w-5" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-text-primary">
                {AGENT_LABELS[agent]}
                {isSafeguard && (
                  <span className="ml-2 text-xs text-safeguard">Last bastion</span>
                )}
              </p>
              <p className="text-xs text-text-muted">
                {status === "running" && "Working…"}
                {status === "complete" && "Done"}
                {status === "pending" && "Waiting"}
                {status === "failed" && "Failed"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
