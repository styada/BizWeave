import { db } from "@/lib/db";
import { loadBusinessContext } from "@/lib/executor/context";
import { buildWebsite, runGenericGoal } from "@/lib/executor/harness/inline";
import { createSandbox, destroySandbox } from "@/lib/executor/sandbox";
import { recordUsage } from "@/lib/usage/meter";
import { hasAnthropicKey, flags } from "@/lib/env";
import { verifyCompletion } from "@/lib/executor/verify";
import { auditWcag } from "@/lib/compliance";
import type { AgentTaskSpec, AgentTaskResult } from "@/lib/types/agent-task";

export type HarnessKind = "claude-agent-sdk" | "opencode" | "deep-agents" | "inline";

/**
 * Choose the harness for a spec:
 *  - Anthropic key + deep-executor flag -> claude-agent-sdk (falls back inline)
 *  - Research-y goals -> deep-agents (falls back inline)
 *  - otherwise inline (LLM in-process / template fallback)
 */
export function chooseHarness(spec: AgentTaskSpec): HarnessKind {
  if (flags.deepExecutor && hasAnthropicKey()) return "claude-agent-sdk";
  const goal = spec.goal.toLowerCase();
  if (/research|competitor|market|analy[sz]e/.test(goal)) return "deep-agents";
  return "inline";
}

/**
 * Run an open-ended deep task. Persists an AgentTask row, enforces a hard
 * budget cap, captures artifacts, records usage, and returns the result.
 */
export async function runTask(params: {
  businessId: string;
  userId: string;
  title: string;
  spec: AgentTaskSpec;
  conversationId?: string;
}): Promise<{ taskId: string; result: AgentTaskResult }> {
  const { businessId, userId, title, spec } = params;
  const budgetUsd = spec.budgetUsd ?? 5;
  const harness = chooseHarness(spec);

  // Idempotency: if a recent task with the same (businessId, title, conversationId)
  // is still running or queued, return it instead of creating a duplicate. This
  // prevents double-sends on retries, double-posts on social, etc. Tasks older
  // than 5 min or in terminal state are not deduplicated.
  const idempotencyKey = `${businessId}:${title}:${params.conversationId ?? ""}`;
  const recent = await db.agentTask.findFirst({
    where: {
      businessId,
      title,
      conversationId: params.conversationId ?? null,
      status: { in: ["queued", "planning", "running", "needs_approval"] },
      createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return {
      taskId: recent.id,
      result: {
        ok: true,
        summary: `Reusing in-flight task (idempotency hit on ${idempotencyKey}).`,
        costUsd: 0,
      },
    };
  }

  const task = await db.agentTask.create({
    data: {
      businessId,
      conversationId: params.conversationId ?? null,
      title,
      harness,
      spec: spec as unknown as object,
      status: "running",
      budgetUsd,
      startedAt: new Date(),
    },
  });

  const sandbox = await createSandbox(task.id);
  if (sandbox.available) {
    await db.agentTask.update({
      where: { id: task.id },
      data: { sandboxId: sandbox.id },
    });
  }

  let result: AgentTaskResult;
  try {
    const ctx = await loadBusinessContext(businessId);
    if (!ctx) throw new Error("Business not found");

    const goal = spec.goal.toLowerCase();
    if (/website|web site|landing|site build|build.*site/.test(goal)) {
      const { site, usedFallback, costUsd } = await buildWebsite(ctx, userId);
      // Persist the generated site (draft until published via guardAction).
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
          status: "draft",
        },
      });
      // WCAG pre-publish gate (content-level; html is body-inner markup).
      const wcag = auditWcag(site.html);
      const contentIssues = wcag.issues.filter(
        (i) => i.startsWith("img_missing_alt") || i === "form_inputs_unlabeled"
      );
      if (contentIssues.length > 0) {
        await db.activityEvent
          .create({
            data: {
              businessId,
              eventType: "compliance",
              level: "warn",
              message: `Accessibility issues in generated site: ${contentIssues.join(", ")}`,
            },
          })
          .catch(() => undefined);
      }

      result = {
        ok: true,
        summary: `Built website for ${ctx.name}${usedFallback ? " (template fallback)" : ""}. Preview it, then publish.`,
        artifacts: [{ kind: "site", value: site.meta.title }],
        costUsd,
      };
    } else {
      result = await runGenericGoal(spec.goal, ctx, userId);
    }

    // Budget enforcement (post-hoc guard; harnesses should stream cost).
    if (result.costUsd > budgetUsd) {
      result = {
        ...result,
        ok: false,
        summary: `Aborted: task cost $${result.costUsd} exceeded budget $${budgetUsd}.`,
      };
    }
  } catch (err) {
    result = {
      ok: false,
      summary: err instanceof Error ? err.message : String(err),
      costUsd: 0,
    };
  } finally {
    await destroySandbox(sandbox);
  }

  // Real-world completion verification before marking done.
  const verification = result.ok
    ? await verifyCompletion({ businessId, goal: spec.goal, result })
    : { verified: false, reason: "task_failed" as string };

  const finalStatus = !result.ok
    ? "failed"
    : verification.verified
      ? "done"
      : "needs_verification";

  await db.agentTask.update({
    where: { id: task.id },
    data: {
      status: finalStatus,
      costUsd: result.costUsd,
      artifacts: (result.artifacts ?? []) as unknown as object,
      error: result.ok ? (verification.verified ? null : `unverified: ${verification.reason}`) : result.summary,
      completedAt: new Date(),
    },
  });

  // Auto-refund credits on verified failure so customers never pay for nothing.
  if (result.ok && !verification.verified && result.costUsd > 0) {
    await refundCredits(businessId, result.costUsd, `unverified task (${verification.reason})`).catch(
      () => undefined
    );
  }

  // Distill successful verified tasks into reusable Skills (Phase 15/20).
  if (result.ok && verification.verified) {
    import("@/lib/learning/distill")
      .then((m) =>
        m.distillSkill({
          businessId,
          userId,
          name: title.slice(0, 80),
          goal: spec.goal,
          steps: [{ action: spec.goal }],
        })
      )
      .catch(() => undefined);
    import("@/lib/learning/evaluate")
      .then((m) => m.scoreTaskOutcome({ businessId, intent: spec.goal, taskId: task.id }))
      .catch(() => undefined);
  }

  await recordUsage({
    businessId,
    kind: "task",
    quantity: 1,
    costUsd: result.costUsd,
    meta: { harness, title },
  });

  return { taskId: task.id, result };
}

/** Credit a business's wallet (used for auto-refunds on verified failure). */
async function refundCredits(businessId: string, amountUsd: number, reason: string): Promise<void> {
  const wallet = await db.creditWallet.findUnique({ where: { businessId } });
  if (!wallet) return;
  const balanceAfterUsd = wallet.balanceUsd + amountUsd;
  await db.creditWallet.update({ where: { businessId }, data: { balanceUsd: balanceAfterUsd } });
  await db.creditLedger.create({
    data: { walletId: wallet.id, deltaUsd: amountUsd, reason: `auto-refund: ${reason}`, balanceAfterUsd },
  });
}
