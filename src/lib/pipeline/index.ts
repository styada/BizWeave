import { db } from "@/lib/db";
import { flags } from "@/lib/env";
import { resolveLlm } from "@/lib/llm/resolve";
import { runAgentPipeline } from "@/lib/agents/orchestrator";
import { runGraph, type GraphNode } from "@/lib/pipeline/graph";
import { runStructuredAgent } from "@/lib/pipeline/steps";
import * as fb from "@/lib/agents/fallback";
import * as sc from "@/lib/agents/contracts";
import * as pr from "@/lib/agents/prompts";
import type {
  BusinessContext,
  IntakeOutput,
  PlannerOutput,
  SiteOutput,
  MarketingOutput,
  SupportOutput,
  SafeguardVerdict,
  OutreachOutput,
  AdsOutput,
  FinanceOutput,
  CompetitorResearchOutput,
  OrchestratorOutput,
} from "@/lib/agents/types";

type PipelineState = {
  businessId: string;
  userId: string;
  runId: string;
  useLlm: boolean;
  ctx: BusinessContext;
  orchestrator?: OrchestratorOutput;
  intake?: IntakeOutput;
  plan?: PlannerOutput;
  site?: SiteOutput;
  marketing?: MarketingOutput;
  support?: SupportOutput;
  safeguard?: SafeguardVerdict;
  outreach?: OutreachOutput;
  ads?: AdsOutput;
  finance?: FinanceOutput;
  competitorResearch?: CompetitorResearchOutput;
};

/**
 * Entry point for the launch pipeline. Behind FEATURE_LANGGRAPH it runs the
 * durable DAG engine (parallel fan-out + checkpointing + LangSmith); otherwise
 * it delegates to the proven sequential `runAgentPipeline` for parity.
 */
export async function runPipeline(
  businessId: string,
  userId: string,
  options?: { taskExecutionId?: string }
) {
  if (!flags.langgraph) {
    return runAgentPipeline(businessId, userId, options);
  }
  return runGraphPipeline(businessId, userId, options);
}

async function runGraphPipeline(
  businessId: string,
  userId: string,
  options?: { taskExecutionId?: string }
) {
  const business = await db.business.findFirst({
    where: { id: businessId, userId },
    include: { inventory: true },
  });
  if (!business) throw new Error("Business not found");

  const ctx: BusinessContext = {
    id: business.id,
    name: business.name,
    type: business.type,
    tagline: business.tagline,
    description: business.description,
    location: business.location,
    phone: business.phone,
    email: business.email,
    inventory: business.inventory,
  };
  const useLlm = !!(await resolveLlm(userId));

  const run = await db.agentRun.create({
    data: {
      businessId,
      status: "running",
      currentStep: "orchestrator",
      taskExecutionId: options?.taskExecutionId,
    },
  });
  await activity(businessId, run.id, "run.started", "Graph pipeline started");

  const nodes: GraphNode<PipelineState>[] = [
    node("orchestrator", [], async (s) => ({
      orchestrator: (
        await runStructuredAgent({
          agent: "orchestrator",
          prompt: pr.orchestratorPrompt(s.ctx),
          userId,
          useLlm,
          fallback: fb.fallbackOrchestrator(s.ctx),
          schema: sc.orchestratorSchema,
        })
      ).value,
    })),
    node("intake", ["orchestrator"], async (s) => ({
      intake: (
        await runStructuredAgent({
          agent: "intake",
          prompt: pr.intakePrompt(s.ctx),
          userId,
          useLlm,
          fallback: fb.fallbackIntake(s.ctx),
          schema: sc.intakeSchema,
        })
      ).value,
    })),
    node("planner", ["intake"], async (s) => ({
      plan: (
        await runStructuredAgent({
          agent: "planner",
          prompt: pr.plannerPrompt(s.ctx, JSON.stringify(s.intake)),
          userId,
          useLlm,
          fallback: fb.fallbackPlan(s.ctx),
          schema: sc.plannerSchema,
        })
      ).value,
    })),
    node("builder", ["planner"], async (s) => {
      const site = (
        await runStructuredAgent({
          agent: "builder",
          prompt: pr.builderPrompt(s.ctx, JSON.stringify(s.intake), JSON.stringify(s.plan)),
          userId,
          useLlm,
          fallback: fb.fallbackSite(s.ctx),
          schema: sc.siteSchema,
        })
      ).value;
      await db.generatedSite.upsert({
        where: { businessId },
        create: { businessId, html: site.html, css: site.css, meta: JSON.stringify(site.meta), status: "draft" },
        update: { html: site.html, css: site.css, meta: JSON.stringify(site.meta) },
      });
      return { site };
    }),
    node("marketing", ["planner"], async (s) => {
      const marketing = (
        await runStructuredAgent({
          agent: "marketing",
          prompt: pr.marketingPrompt(s.ctx, JSON.stringify(s.intake), JSON.stringify(s.plan)),
          userId,
          useLlm,
          fallback: fb.fallbackMarketing(s.ctx),
          schema: sc.marketingSchema,
        })
      ).value;
      await db.marketingPlan.upsert({
        where: { businessId },
        create: { businessId, channels: JSON.stringify(marketing.channels), content: JSON.stringify(marketing), status: "draft" },
        update: { channels: JSON.stringify(marketing.channels), content: JSON.stringify(marketing) },
      });
      return { marketing };
    }),
    node("support", ["planner"], async (s) => ({
      support: (
        await runStructuredAgent({
          agent: "support",
          prompt: pr.supportPrompt(s.ctx),
          userId,
          useLlm,
          fallback: fb.fallbackSupport(s.ctx),
          schema: sc.supportSchema,
        })
      ).value,
    })),
    node("competitor-research", ["intake"], async (s) => ({
      competitorResearch: (
        await runStructuredAgent({
          agent: "competitor-research",
          prompt: pr.competitorResearchPrompt(s.ctx, JSON.stringify(s.intake)),
          userId,
          useLlm,
          fallback: fb.fallbackCompetitorResearch(s.ctx),
          schema: sc.competitorResearchSchema,
        })
      ).value,
    })),
    node("safeguard", ["builder", "marketing", "support"], async (s) => ({
      safeguard: (
        await runStructuredAgent({
          agent: "safeguard",
          prompt: pr.safeguardPrompt(s.ctx, {
            intake: JSON.stringify(s.intake),
            plan: JSON.stringify(s.plan),
            site: JSON.stringify(s.site),
            marketing: JSON.stringify(s.marketing),
            support: JSON.stringify(s.support),
          }),
          userId,
          useLlm,
          fallback: fb.fallbackSafeguard(true),
          schema: sc.safeguardSchema,
        })
      ).value,
    })),
    node("outreach", ["safeguard"], async (s) => ({
      outreach: (
        await runStructuredAgent({
          agent: "outreach",
          prompt: pr.outreachPrompt(s.ctx, JSON.stringify(s.plan)),
          userId,
          useLlm,
          fallback: fb.fallbackOutreach(s.ctx),
          schema: sc.outreachSchema,
        })
      ).value,
    })),
    node("ads", ["safeguard"], async (s) => ({
      ads: (
        await runStructuredAgent({
          agent: "ads",
          prompt: pr.adsPrompt(s.ctx, JSON.stringify(s.plan)),
          userId,
          useLlm,
          fallback: fb.fallbackAds(s.ctx),
          schema: sc.adsSchema,
        })
      ).value,
    })),
    node("finance", ["safeguard"], async (s) => ({
      finance: (
        await runStructuredAgent({
          agent: "finance",
          prompt: pr.financePrompt(s.ctx, JSON.stringify(s.plan)),
          userId,
          useLlm,
          fallback: fb.fallbackFinance(s.ctx),
          schema: sc.financeSchema,
        })
      ).value,
    })),
  ];

  try {
    const result = await runGraph<PipelineState>({
      nodes,
      initialState: { businessId, userId, runId: run.id, useLlm, ctx },
      onCheckpoint: async (nodeId, state) => {
        await db.agentRun.update({ where: { id: run.id }, data: { currentStep: nodeId } }).catch(() => undefined);
        await db.agentLog
          .create({ data: { runId: run.id, agent: nodeId, status: "complete" } })
          .catch(() => undefined);
        await activity(businessId, run.id, "step.completed", `${nodeId} completed`);
        void state;
      },
    });

    const verdict = result.state.safeguard ?? fb.fallbackSafeguard(true);
    const finalStatus = await finalize(businessId, run.id, verdict);

    await db.agentRun.update({
      where: { id: run.id },
      data: { status: "complete", currentStep: "done", completedAt: new Date() },
    });
    await activity(businessId, run.id, "run.completed", `Run ${run.id} completed`);
    return { runId: run.id, approved: verdict.approved, useLlm, finalStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    await db.agentRun.update({ where: { id: run.id }, data: { status: "failed", error: message } });
    await db.business.update({ where: { id: businessId }, data: { status: "failed" } }).catch(() => undefined);
    await activity(businessId, run.id, "run.failed", message, "error");
    throw error;
  }
}

function node(
  id: string,
  deps: string[],
  run: (s: PipelineState) => Promise<Partial<PipelineState>>
): GraphNode<PipelineState> {
  return { id, deps, run };
}

async function finalize(
  businessId: string,
  runId: string,
  verdict: SafeguardVerdict
): Promise<string> {
  const baseStatus =
    verdict.approved && verdict.reliabilityIndex >= 70 ? "live" : "review";
  const publishPolicy = await db.approvalPolicy.findUnique({
    where: { businessId_actionType: { businessId, actionType: "publish_artifacts" } },
  });
  const requiresApproval = publishPolicy
    ? publishPolicy.enabled && publishPolicy.requiresApproval
    : true;
  const riskLevel =
    !verdict.approved || verdict.reliabilityIndex < 70
      ? "high"
      : verdict.reliabilityIndex < 85
        ? "medium"
        : "low";

  let finalStatus = baseStatus;
  let needsApproval = false;
  if (requiresApproval && riskLevel !== "low") {
    needsApproval = true;
    finalStatus = "needs_approval";
    await db.pendingAction.create({
      data: {
        businessId,
        runId,
        actionType: "publish_artifacts",
        riskLevel,
        payload: JSON.stringify({
          reliabilityIndex: verdict.reliabilityIndex,
          approved: verdict.approved,
          issues: verdict.issues,
        }),
      },
    });
  }

  await db.business.update({ where: { id: businessId }, data: { status: finalStatus } });
  if (verdict.approved && !needsApproval) {
    await db.generatedSite.updateMany({ where: { businessId }, data: { status: "published" } });
    await db.marketingPlan.updateMany({ where: { businessId }, data: { status: "active" } });
  }
  return finalStatus;
}

async function activity(
  businessId: string,
  runId: string,
  eventType: string,
  message: string,
  level: "info" | "warn" | "error" = "info"
): Promise<void> {
  await db.activityEvent
    .create({ data: { businessId, runId, agent: "system", eventType, level, message } })
    .catch(() => undefined);
}
