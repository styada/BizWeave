/**
 * Phase T.2: Next.js side of the Temporal bridge.
 *
 * The chat path (or any Next.js route) imports startBuildSiteWorkflow()
 * here. Under the hood, this creates a Temporal client connection
 * (cached on globalThis) and starts a workflow. The worker (separate
 * Node process) picks it up and runs the activities.
 *
 * The actual workflow file lives at worker/src/workflows/buildSite.ts.
 * We import it via a relative path so the Next.js build doesn't need
 * to know about the worker directory.
 */
import { Client } from "@temporalio/client";
import { nanoid } from "nanoid";

declare global {
  // eslint-disable-next-line no-var
  var __temporalNextClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __temporalNextConnectionPromise: Promise<unknown> | undefined;
}

const TASK_QUEUE = "bizweave-operator";

async function getClient(): Promise<Client> {
  if (globalThis.__temporalNextClient) return globalThis.__temporalNextClient;
  // Lazy import of the connection module so the Next.js bundle doesn't
  // eagerly load the worker code. The build-site workflow is loaded
  // by its module path.
  const { Client: TClient, Connection } = await import("@temporalio/client");
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
  const connection = await Connection.connect({ address });
  globalThis.__temporalNextClient = new TClient({ connection, namespace });
  return globalThis.__temporalNextClient!;
}

export type StartBuildSiteResult = {
  workflowId: string;
  runId: string;
  /** Synthetic taskId so the existing UI treats this like a regular task. */
  taskId: string;
};

/**
 * Start a build-site workflow. Returns immediately with a workflowId.
 * The workflow runs asynchronously in the worker; the chat UI shows
 * progress via the activity feed.
 */
export async function startBuildSiteWorkflow(params: {
  businessId: string;
  userId: string;
  taskExecutionId?: string;
}): Promise<StartBuildSiteResult> {
  const client = await getClient();
  const workflowId = `buildsite-${params.businessId}-${nanoid(8)}`;

  const handle = await client.workflow.start("buildSiteWorkflow", {
    args: [params],
    taskQueue: TASK_QUEUE,
    workflowId,
  });

  return {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
    taskId: `temporal-${workflowId}`,
  };
}

/** Fetch the current state of a workflow (for the activity feed). */
export async function describeBuildSite(workflowId: string) {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  return handle.describe();
}
