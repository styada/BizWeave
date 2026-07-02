import { db } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";

type Cadence =
  | "manual"
  | "every_2_hours"
  | "every_3_hours"
  | "every_6_hours"
  | "daily"
  | "twice_daily";

const DEFAULT_TASKS: Array<{ agent: string; cadence: Cadence }> = [
  { agent: "orchestrator", cadence: "twice_daily" },
];

const RETRY_BASE_DELAY_MS = 30_000;
const RETRY_MAX_DELAY_MS = 10 * 60_000;

function computeRetryDelayMs(retryCount: number) {
  const delay = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, retryCount - 1);
  return Math.min(delay, RETRY_MAX_DELAY_MS);
}

function nextRunFromCadence(cadence: string, now = new Date()) {
  const next = new Date(now);
  switch (cadence) {
    case "every_2_hours":
      next.setHours(next.getHours() + 2);
      return next;
    case "every_3_hours":
      next.setHours(next.getHours() + 3);
      return next;
    case "every_6_hours":
      next.setHours(next.getHours() + 6);
      return next;
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "twice_daily":
      next.setHours(next.getHours() + 12);
      return next;
    case "manual":
    default:
      return null;
  }
}

export async function bootstrapBusinessAutomation(businessId: string) {
  await Promise.all(
    DEFAULT_TASKS.map((task) =>
      db.scheduledTask.upsert({
        where: {
          businessId_agent: {
            businessId,
            agent: task.agent,
          },
        },
        create: {
          businessId,
          agent: task.agent,
          cadence: task.cadence,
          nextRunAt: nextRunFromCadence(task.cadence),
          enabled: true,
        },
        update: {
          cadence: task.cadence,
          enabled: true,
          nextRunAt: nextRunFromCadence(task.cadence),
        },
      })
    )
  );

  await db.approvalPolicy.upsert({
    where: {
      businessId_actionType: {
        businessId,
        actionType: "publish_artifacts",
      },
    },
    create: {
      businessId,
      actionType: "publish_artifacts",
      enabled: true,
      requiresApproval: true,
      minRiskLevel: "medium",
    },
    update: {},
  });
}

export async function enqueueBusinessRun(params: {
  businessId: string;
  source: "manual" | "scheduled";
  agent?: string;
}) {
  const agent = params.agent ?? "orchestrator";
  let scheduledTask = await db.scheduledTask.findUnique({
    where: {
      businessId_agent: {
        businessId: params.businessId,
        agent,
      },
    },
  });

  if (!scheduledTask) {
    scheduledTask = await db.scheduledTask.create({
      data: {
        businessId: params.businessId,
        agent,
        cadence: params.source === "manual" ? "manual" : "twice_daily",
        enabled: true,
        nextRunAt:
          params.source === "manual"
            ? null
            : nextRunFromCadence("twice_daily"),
      },
    });
  }

  const execution = await db.taskExecution.create({
    data: {
      scheduledTaskId: scheduledTask.id,
      status: "queued",
      nextAttemptAt: new Date(),
    },
  });

  await db.activityEvent.create({
    data: {
      businessId: params.businessId,
      agent,
      eventType: "execution.queued",
      level: "info",
      message: `Execution ${execution.id} queued`,
      payload: JSON.stringify({
        source: params.source,
        scheduledTaskId: scheduledTask.id,
      }),
    },
  });

  return execution;
}

export async function queueDueScheduledTasks(now = new Date()) {
  const dueTasks = await db.scheduledTask.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    include: {
      executions: {
        where: { status: { in: ["queued", "running"] } },
        take: 1,
      },
    },
  });

  let queued = 0;
  for (const task of dueTasks) {
    if (task.executions.length > 0) {
      continue;
    }

    await db.taskExecution.create({
      data: {
        scheduledTaskId: task.id,
        status: "queued",
        retryCount: 0,
        nextAttemptAt: now,
      },
    });

    await db.scheduledTask.update({
      where: { id: task.id },
      data: {
        lastRunAt: now,
        nextRunAt: nextRunFromCadence(task.cadence, now),
      },
    });

    queued += 1;
  }

  return { queued };
}

async function processExecution(exec: {
  id: string;
  retryCount: number;
  maxAttempts: number;
  scheduledTask: {
    businessId: string;
    agent: string;
    business: {
      id: string;
      userId: string;
    };
  };
}) {
  await db.taskExecution.update({
    where: { id: exec.id },
    data: {
      status: "running",
      startedAt: new Date(),
      nextAttemptAt: null,
    },
  });

  await db.activityEvent.create({
    data: {
      businessId: exec.scheduledTask.businessId,
      agent: exec.scheduledTask.agent,
      eventType: "execution.started",
      level: "info",
      message: `Execution ${exec.id} started`,
    },
  });

  try {
    const run = await runPipeline(
      exec.scheduledTask.business.id,
      exec.scheduledTask.business.userId,
      { taskExecutionId: exec.id }
    );

    await db.taskExecution.update({
      where: { id: exec.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        error: null,
        run: { connect: { id: run.runId } },
      },
    });

    await db.activityEvent.create({
      data: {
        businessId: exec.scheduledTask.businessId,
        runId: run.runId,
        agent: exec.scheduledTask.agent,
        eventType: "execution.completed",
        level: "info",
        message: `Execution ${exec.id} completed`,
      },
    });

    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed";

    const nextRetryCount = exec.retryCount + 1;
    const shouldRetry = nextRetryCount < exec.maxAttempts;
    const retryDelayMs = computeRetryDelayMs(nextRetryCount);
    const nextAttemptAt = shouldRetry
      ? new Date(Date.now() + retryDelayMs)
      : null;

    await db.taskExecution.update({
      where: { id: exec.id },
      data: {
        status: shouldRetry ? "queued" : "dead_letter",
        retryCount: nextRetryCount,
        nextAttemptAt,
        completedAt: shouldRetry ? null : new Date(),
        error: message,
        deadLetteredAt: shouldRetry ? null : new Date(),
        deadLetterReason: shouldRetry ? null : message,
      },
    });

    await db.activityEvent.create({
      data: {
        businessId: exec.scheduledTask.businessId,
        agent: exec.scheduledTask.agent,
        eventType: shouldRetry ? "execution.retry_scheduled" : "execution.dead_letter",
        level: shouldRetry ? "warn" : "error",
        message: shouldRetry
          ? `Execution ${exec.id} failed; retry scheduled`
          : `Execution ${exec.id} moved to dead letter`,
        payload: JSON.stringify({
          error: message,
          retryCount: nextRetryCount,
          maxAttempts: exec.maxAttempts,
          nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
        }),
      },
    });

    return { ok: false as const, message, shouldRetry };
  }
}

export async function processExecutionById(executionId: string) {
  const exec = await db.taskExecution.findFirst({
    where: {
      id: executionId,
      status: "queued",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    include: {
      scheduledTask: {
        include: {
          business: {
            select: { id: true, userId: true },
          },
        },
      },
    },
  });

  if (!exec) {
    return { processed: false, reason: "not_found_or_not_queued" as const };
  }

  const result = await processExecution(exec);
  return { processed: true, result };
}

export async function processQueuedExecutions(limit = 5, businessId?: string) {
  const now = new Date();
  const queued = await db.taskExecution.findMany({
    where: {
      status: "queued",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      scheduledTask: businessId ? { businessId } : undefined,
    },
    include: {
      scheduledTask: {
        include: {
          business: {
            select: { id: true, userId: true },
          },
        },
      },
    },
    orderBy: { queuedAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let failed = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const exec of queued) {
    const result = await processExecution(exec);
    if (result.ok) {
      processed += 1;
    } else {
      failed += 1;
      if (result.shouldRetry) {
        retried += 1;
      } else {
        deadLettered += 1;
      }
    }
  }

  return {
    picked: queued.length,
    processed,
    failed,
    retried,
    deadLettered,
  };
}
