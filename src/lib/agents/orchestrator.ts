import { db } from "@/lib/db";
import { complete } from "@/lib/llm/client";
import { getPreferredProvider } from "@/lib/llm/keys";
import {
  fallbackIntake,
  fallbackPlan,
  fallbackSite,
  fallbackMarketing,
  fallbackSupport,
  fallbackSafeguard,
  fallbackOutreach,
  fallbackAds,
  fallbackFinance,
  fallbackCompetitorResearch,
  fallbackOrchestrator,
} from "./fallback";
import {
  intakeSchema,
  marketingSchema,
  parseWithSchema,
  plannerSchema,
  safeguardSchema,
  siteSchema,
  supportSchema,
  outreachSchema,
  adsSchema,
  financeSchema,
  competitorResearchSchema,
  orchestratorSchema,
} from "./contracts";
import {
  intakePrompt,
  plannerPrompt,
  builderPrompt,
  marketingPrompt,
  supportPrompt,
  safeguardPrompt,
  outreachPrompt,
  adsPrompt,
  financePrompt,
  competitorResearchPrompt,
  orchestratorPrompt,
} from "./prompts";
import {
  AGENT_PIPELINE,
  type AgentId,
  type BusinessContext,
  type IntakeOutput,
  type MarketingOutput,
  type PlannerOutput,
  type SafeguardVerdict,
  type SiteOutput,
  type SupportOutput,
  type OutreachOutput,
  type AdsOutput,
  type FinanceOutput,
  type CompetitorResearchOutput,
  type OrchestratorOutput,
} from "./types";

const AGENT_TIMEOUT_MS = 45_000;
const STEP_MAX_ATTEMPTS = 2;

async function emitActivity(params: {
  businessId: string;
  runId?: string;
  agent?: AgentId | "system";
  eventType: string;
  message: string;
  level?: "info" | "warn" | "error";
  payload?: unknown;
}) {
  try {
    await db.activityEvent.create({
      data: {
        businessId: params.businessId,
        runId: params.runId,
        agent: params.agent,
        eventType: params.eventType,
        message: params.message,
        level: params.level ?? "info",
        payload: params.payload ? JSON.stringify(params.payload) : undefined,
      },
    });
  } catch {
    // Non-blocking by design; activity stream should not fail runs.
  }
}

async function runAgentStep(
  agent: AgentId,
  prompt: string,
  userId: string,
  useLlm: boolean
): Promise<string> {
  if (!useLlm) {
    return "";
  }

  const creds = await getPreferredProvider(userId);
  if (!creds) return "";

  const responsePromise = complete(
    [
      {
        role: "system",
        content:
          "You are a specialized AI agent for Bizweave. Follow instructions precisely. Return only the requested format.",
      },
      { role: "user", content: prompt },
    ],
    { provider: creds.provider, apiKey: creds.apiKey, temperature: 0.6 }
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${agent} timed out after ${AGENT_TIMEOUT_MS}ms`));
    }, AGENT_TIMEOUT_MS);
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);

  return response.content;
}

type StepResult<T> = {
  value: T;
  raw: string;
  usedFallback: boolean;
};

async function runStructuredStep<T>(params: {
  agent: AgentId;
  prompt: string;
  userId: string;
  useLlm: boolean;
  fallback: T;
  schema: Parameters<typeof parseWithSchema<T>>[1];
}): Promise<StepResult<T>> {
  if (!params.useLlm) {
    return {
      value: params.fallback,
      raw: JSON.stringify(params.fallback),
      usedFallback: true,
    };
  }

  let lastRaw = "";
  for (let attempt = 1; attempt <= STEP_MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await runAgentStep(
        params.agent,
        params.prompt,
        params.userId,
        params.useLlm
      );
      lastRaw = raw;
      const parsed = parseWithSchema(raw, params.schema, params.fallback);
      if (!parsed.usedFallback) {
        return { value: parsed.value, raw, usedFallback: false };
      }
    } catch {
      // Retry path falls through, final fallback handled below.
    }
  }

  return {
    value: params.fallback,
    raw: lastRaw || JSON.stringify(params.fallback),
    usedFallback: true,
  };
}

export async function runAgentPipeline(
  businessId: string,
  userId: string,
  options?: { taskExecutionId?: string }
) {
  const business = await db.business.findFirst({
    where: { id: businessId, userId },
    include: { inventory: true },
  });

  if (!business) {
    throw new Error("Business not found");
  }

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

  const creds = await getPreferredProvider(userId);
  const useLlm = !!creds;

  const run = await db.agentRun.create({
    data: {
      businessId,
      status: "running",
      currentStep: "orchestrator",
      taskExecutionId: options?.taskExecutionId,
    },
  });

  await emitActivity({
    businessId,
    runId: run.id,
    agent: "system",
    eventType: "run.started",
    message: `Run ${run.id} started`,
    payload: { useLlm },
  });

  const artifacts: {
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
  } = {};
  let safeguardVerdict: SafeguardVerdict = fallbackSafeguard(true);

  try {
    for (const agent of AGENT_PIPELINE) {
      await db.agentRun.update({
        where: { id: run.id },
        data: { currentStep: agent },
      });

      let output = "";
      let prompt = "";
      let usedFallback = false;
      const logStatus = "complete";
      const startedAt = Date.now();

      await emitActivity({
        businessId,
        runId: run.id,
        agent,
        eventType: "step.started",
        message: `${agent} started`,
      });

      try {
        switch (agent) {
          case "intake": {
            prompt = intakePrompt(ctx);
            const fallback = fallbackIntake(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: intakeSchema,
            });
            output = JSON.stringify(result.value);
            artifacts.intake = result.value;
            usedFallback = result.usedFallback;
            break;
          }
          case "planner": {
            prompt = plannerPrompt(ctx, JSON.stringify(artifacts.intake));
            const fallback = fallbackPlan(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: plannerSchema,
            });
            output = JSON.stringify(result.value);
            artifacts.plan = result.value;
            usedFallback = result.usedFallback;
            break;
          }
          case "builder": {
            prompt = builderPrompt(
              ctx,
              JSON.stringify(artifacts.intake),
              JSON.stringify(artifacts.plan)
            );
            const fallback = fallbackSite(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: siteSchema,
            });
            const site = result.value;
            output = JSON.stringify(site);
            artifacts.site = site;
            usedFallback = result.usedFallback;

            await db.generatedSite.upsert({
              where: { businessId },
              create: {
                businessId,
                html: site.html,
                css: site.css,
                meta: JSON.stringify(site.meta),
                status: "draft",
              },
              update: {
                html: site.html,
                css: site.css,
                meta: JSON.stringify(site.meta),
              },
            });
            break;
          }
          case "marketing": {
            prompt = marketingPrompt(
              ctx,
              JSON.stringify(artifacts.intake),
              JSON.stringify(artifacts.plan)
            );
            const fallback = fallbackMarketing(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: marketingSchema,
            });
            const marketing = result.value;
            output = JSON.stringify(marketing);
            artifacts.marketing = marketing;
            usedFallback = result.usedFallback;

            await db.marketingPlan.upsert({
              where: { businessId },
              create: {
                businessId,
                channels: JSON.stringify(marketing.channels),
                content: JSON.stringify(marketing),
                status: "draft",
              },
              update: {
                channels: JSON.stringify(marketing.channels),
                content: JSON.stringify(marketing),
              },
            });
            break;
          }
          case "support": {
            prompt = supportPrompt(ctx);
            const fallback = fallbackSupport(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: supportSchema,
            });
            output = JSON.stringify(result.value);
            artifacts.support = result.value;
            usedFallback = result.usedFallback;
            break;
          }
          case "safeguard": {
            prompt = safeguardPrompt(ctx, {
              intake: JSON.stringify(artifacts.intake),
              plan: JSON.stringify(artifacts.plan),
              site: JSON.stringify(artifacts.site),
              marketing: JSON.stringify(artifacts.marketing),
              support: JSON.stringify(artifacts.support),
            });
            const fallback = fallbackSafeguard(true);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: safeguardSchema,
            });
            safeguardVerdict = result.value;
            output = JSON.stringify(safeguardVerdict);
            artifacts.safeguard = safeguardVerdict;
            usedFallback = result.usedFallback;
            break;
          }
          case "orchestrator": {
            // TODO: Option E — full orchestrator that reorders pipeline based on output
            prompt = orchestratorPrompt(ctx);
            const fallback = fallbackOrchestrator(ctx);
            const result = await runStructuredStep<OrchestratorOutput>({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: orchestratorSchema,
            });
            output = JSON.stringify(result.value);
            artifacts.orchestrator = result.value;
            usedFallback = result.usedFallback;
            break;
          }
          case "outreach": {
            // TODO: Execute real outreach campaigns (email, SMS, LinkedIn)
            prompt = outreachPrompt(ctx, JSON.stringify(artifacts.plan));
            const fallback = fallbackOutreach(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: outreachSchema,
            });
            output = JSON.stringify(result.value);
            artifacts.outreach = result.value;
            usedFallback = result.usedFallback;
            break;
          }
          case "ads": {
            // TODO: Create actual ad campaigns on Google/Meta/LinkedIn via API
            prompt = adsPrompt(ctx, JSON.stringify(artifacts.plan));
            const fallback = fallbackAds(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: adsSchema,
            });
            output = JSON.stringify(result.value);
            artifacts.ads = result.value;
            usedFallback = result.usedFallback;
            break;
          }
          case "finance": {
            // TODO: Connect to Stripe/Xero/QuickBooks for real revenue data
            prompt = financePrompt(ctx, JSON.stringify(artifacts.plan));
            const fallback = fallbackFinance(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: financeSchema,
            });
            output = JSON.stringify(result.value);
            artifacts.finance = result.value;
            usedFallback = result.usedFallback;
            break;
          }
          case "competitor-research": {
            // TODO: Scrape competitor websites and social for real data
            prompt = competitorResearchPrompt(ctx, JSON.stringify(artifacts.intake));
            const fallback = fallbackCompetitorResearch(ctx);
            const result = await runStructuredStep({
              agent,
              prompt,
              userId,
              useLlm,
              fallback,
              schema: competitorResearchSchema,
            });
            output = JSON.stringify(result.value);
            artifacts.competitorResearch = result.value;
            usedFallback = result.usedFallback;
            break;
          }
        }
      } catch (stepError) {
        const message =
          stepError instanceof Error ? stepError.message : "Agent step failed";
        const durationMs = Date.now() - startedAt;
        await db.agentLog.create({
          data: {
            runId: run.id,
            agent,
            status: "failed",
            output: message,
            durationMs,
            errorCode: "STEP_EXECUTION_FAILED",
          },
        });

        await emitActivity({
          businessId,
          runId: run.id,
          agent,
          eventType: "step.failed",
          level: "error",
          message: `${agent} failed`,
          payload: { error: message, durationMs },
        });
        throw stepError;
      }

      const durationMs = Date.now() - startedAt;
      await db.agentLog.create({
        data: {
          runId: run.id,
          agent,
          status: logStatus,
          input: prompt.slice(0, 5000),
          output: `${output.slice(0, 10000)}${usedFallback ? "\n\n[fallback=true]" : ""}`,
          durationMs,
          usedFallback,
          errorCode: usedFallback ? "FALLBACK_USED" : null,
        },
      });

      await emitActivity({
        businessId,
        runId: run.id,
        agent,
        eventType: "step.completed",
        level: usedFallback ? "warn" : "info",
        message: `${agent} completed`,
        payload: { usedFallback, durationMs },
      });
    }

    const baseFinalStatus =
      safeguardVerdict.approved && safeguardVerdict.reliabilityIndex >= 70
        ? "live"
        : "review";

    const publishPolicy = await db.approvalPolicy.findUnique({
      where: {
        businessId_actionType: {
          businessId,
          actionType: "publish_artifacts",
        },
      },
    });

    const requiresApproval = publishPolicy
      ? publishPolicy.enabled && publishPolicy.requiresApproval
      : true;

    const riskLevel =
      !safeguardVerdict.approved || safeguardVerdict.reliabilityIndex < 70
        ? "high"
        : safeguardVerdict.reliabilityIndex < 85
          ? "medium"
          : "low";

    let finalStatus = baseFinalStatus;
    let needsApproval = false;

    if (requiresApproval && riskLevel !== "low") {
      needsApproval = true;
      finalStatus = "needs_approval";
      await db.pendingAction.create({
        data: {
          businessId,
          runId: run.id,
          actionType: "publish_artifacts",
          riskLevel,
          payload: JSON.stringify({
            reliabilityIndex: safeguardVerdict.reliabilityIndex,
            approved: safeguardVerdict.approved,
            issues: safeguardVerdict.issues,
            revisions: safeguardVerdict.revisions,
          }),
        },
      });

      await emitActivity({
        businessId,
        runId: run.id,
        agent: "system",
        eventType: "approval.required",
        level: "warn",
        message: "Publish artifacts requires manual approval",
        payload: { riskLevel, reliabilityIndex: safeguardVerdict.reliabilityIndex },
      });
    }

    await db.business.update({
      where: { id: businessId },
      data: { status: finalStatus },
    });

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "complete",
        currentStep: "done",
        completedAt: new Date(),
      },
    });

    if (safeguardVerdict.approved && !needsApproval) {
      await db.generatedSite.updateMany({
        where: { businessId },
        data: { status: "published" },
      });
      await db.marketingPlan.updateMany({
        where: { businessId },
        data: { status: "active" },
      });
    }

    await emitActivity({
      businessId,
      runId: run.id,
      agent: "system",
      eventType: "run.completed",
      level: needsApproval ? "warn" : "info",
      message: `Run ${run.id} completed`,
      payload: {
        finalStatus,
        needsApproval,
        reliabilityIndex: safeguardVerdict.reliabilityIndex,
      },
    });

    return {
      runId: run.id,
      approved: safeguardVerdict.approved,
      useLlm,
      needsApproval,
      finalStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    await db.agentRun.update({
      where: { id: run.id },
      data: { status: "failed", error: message },
    });
    await db.business.update({
      where: { id: businessId },
      data: { status: "failed" },
    });
    await emitActivity({
      businessId,
      runId: run.id,
      agent: "system",
      eventType: "run.failed",
      level: "error",
      message: `Run ${run.id} failed`,
      payload: { error: message },
    });
    throw error;
  }
}
