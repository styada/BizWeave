import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentPipeline } from "@/components/agents/agent-pipeline";
import { SitePreview } from "@/components/site/site-preview";
import { RunAgentsButton } from "@/components/dashboard/run-agents-button";
import { PendingApprovals } from "@/components/dashboard/pending-approvals";
import { ScheduleControls } from "@/components/dashboard/schedule-controls";
import { AGENT_PIPELINE } from "@/lib/agents/types";
import { ArrowLeft, Eye } from "lucide-react";

function parseJsonObject(raw: string) {
  const cleaned = raw.replace(/\n\n\[fallback=true\]$/, "");
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objectMatch) return null;
  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    include: {
      inventory: { take: 20 },
      site: true,
      marketing: true,
      pendingActions: {
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 5,
      },
      scheduledTasks: {
        orderBy: { createdAt: "asc" },
        take: 5,
      },
      activityEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      agentRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          logs: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!business) notFound();

  const recentExecutions = await db.taskExecution.findMany({
    where: {
      scheduledTask: {
        businessId: id,
      },
    },
    include: {
      scheduledTask: {
        select: {
          agent: true,
        },
      },
    },
    orderBy: { queuedAt: "desc" },
    take: 10,
  });

  const lastRun = business.agentRuns[0];
  const completedSteps =
    lastRun?.logs.filter((l) => l.status === "complete").map((l) => l.agent) ?? [];
  const isRunning = lastRun?.status === "running";

  let marketing: { channels?: string[]; campaigns?: { name: string; channel: string; content: string }[] } | null = null;
  if (business.marketing?.content) {
    try {
      marketing = JSON.parse(business.marketing.content);
    } catch {
      marketing = null;
    }
  }

  let safeguardSummary = "";
  let safeguardReliability: {
    reliabilityIndex?: number;
    scores?: { safety?: number; consistency?: number; channelReadiness?: number };
    differentiatorInsight?: string;
  } | null = null;
  const safeguardLog = lastRun?.logs.find((l) => l.agent === "safeguard");
  if (safeguardLog?.output) {
    const v = parseJsonObject(safeguardLog.output);
    if (v) {
      safeguardSummary = v.summary ?? "";
      safeguardReliability = {
        reliabilityIndex: v.reliabilityIndex,
        scores: v.scores,
        differentiatorInsight: v.differentiatorInsight,
      };
    }
  }

  return (
    <div className="p-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to overview
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          <p className="mt-1 capitalize text-[var(--text-secondary)]">
            {business.type.replace(/-/g, " ")}
            {business.location && ` · ${business.location}`}
          </p>
        </div>
        <div className="flex gap-3">
          {business.site && (
            <Link href={`/dashboard/${id}/preview`}>
              <Button variant="secondary">
                <Eye className="h-4 w-4" />
                Preview site
              </Button>
            </Link>
          )}
          <RunAgentsButton businessId={id} disabled={isRunning} />
        </div>
      </div>

      <div className="mt-6">
        <PendingApprovals
          businessId={id}
          actions={business.pendingActions.map((action) => ({
            id: action.id,
            actionType: action.actionType,
            riskLevel: action.riskLevel,
            createdAt: action.createdAt.toISOString(),
          }))}
        />
      </div>

      <div className="mt-4">
        <ScheduleControls
          businessId={id}
          tasks={business.scheduledTasks.map((task) => ({
            id: task.id,
            agent: task.agent,
            cadence: task.cadence,
            enabled: task.enabled,
            nextRunAt: task.nextRunAt?.toISOString() ?? null,
          }))}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-lg font-semibold">Agent pipeline</h2>
          <AgentPipeline
            currentStep={isRunning ? lastRun?.currentStep : undefined}
            completedSteps={isRunning ? completedSteps : AGENT_PIPELINE}
            failedStep={lastRun?.status === "failed" ? lastRun.currentStep : undefined}
          />
          {safeguardSummary && (
            <Card className="mt-4 border-[var(--safeguard)]/30">
              <CardHeader>
                <CardTitle className="text-base text-[var(--safeguard)]">
                  Safeguard verdict
                </CardTitle>
                <p className="text-sm text-[var(--text-secondary)]">{safeguardSummary}</p>
                {safeguardReliability?.reliabilityIndex != null && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      Trust Index
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--accent-primary)]">
                      {safeguardReliability.reliabilityIndex}/100
                    </p>
                    {safeguardReliability.scores && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--text-secondary)]">
                        <div>
                          <p className="text-[var(--text-muted)]">Safety</p>
                          <p>{safeguardReliability.scores.safety ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-muted)]">Consistency</p>
                          <p>{safeguardReliability.scores.consistency ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-muted)]">Channel</p>
                          <p>{safeguardReliability.scores.channelReadiness ?? "-"}</p>
                        </div>
                      </div>
                    )}
                    {safeguardReliability.differentiatorInsight && (
                      <p className="mt-3 text-xs text-[var(--accent-secondary)]">
                        {safeguardReliability.differentiatorInsight}
                      </p>
                    )}
                  </div>
                )}
              </CardHeader>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {business.site ? (
            <div>
              <h2 className="mb-4 text-lg font-semibold">Site preview</h2>
              <div className="max-h-[400px] overflow-hidden rounded-2xl border border-white/10">
                <SitePreview html={business.site.html} css={business.site.css} />
              </div>
            </div>
          ) : (
            <Card className="py-12 text-center">
              <p className="text-[var(--text-secondary)]">No site generated yet</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Run agents to weave your website
              </p>
            </Card>
          )}

          {marketing?.campaigns && marketing.campaigns.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">Marketing plan</h2>
              <div className="space-y-3">
                {marketing.campaigns.map((c, i) => (
                  <Card key={i} className="p-4">
                    <p className="text-xs font-medium uppercase text-[var(--accent-secondary)]">
                      {c.channel}
                    </p>
                    <p className="mt-1 font-medium">{c.name}</p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{c.content}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {business.inventory.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Inventory ({business.inventory.length} shown)</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[var(--bg-surface)]">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {business.inventory.map((item) => (
                  <tr key={item.id} className="border-b border-white/5">
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{item.category ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {item.price != null ? `$${item.price.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {business.activityEvents.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Recent activity</h2>
          <div className="space-y-2 rounded-xl border border-white/10 p-3">
            {business.activityEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-medium">{event.message}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {event.eventType}
                    {event.agent ? ` · ${event.agent}` : ""}
                  </p>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {event.createdAt.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentExecutions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Queue health</h2>
          <div className="space-y-2 rounded-xl border border-white/10 p-3">
            {recentExecutions.map((execution) => (
              <div
                key={execution.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-medium">
                    {execution.scheduledTask.agent} · {execution.status}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Attempts: {execution.retryCount}/{execution.maxAttempts}
                    {execution.nextAttemptAt
                      ? ` · Next attempt ${execution.nextAttemptAt.toLocaleString()}`
                      : ""}
                  </p>
                  {execution.deadLetterReason && (
                    <p className="text-xs text-[var(--error)]">
                      Dead letter: {execution.deadLetterReason}
                    </p>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {execution.queuedAt.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
