/**
 * Phase T.1: Temporal worker entry point.
 *
 * Run with: `npm run worker:temporal`
 *
 * Wires the buildSite workflow + activities to a Temporal worker that
 * polls the TASK_QUEUE. Add more workflows here as we convert them
 * (Phase T.2 pipeline, Phase T.3 schedules).
 */
import { Worker } from "@temporalio/worker";
import { TASK_QUEUE, getTemporalAddress } from "./connection";

async function main() {
  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    activities: require("./activities/buildSite"),
    taskQueue: TASK_QUEUE,
    address: getTemporalAddress(),
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  });

  console.log(`[temporal-worker] connected to ${getTemporalAddress()}`);
  console.log(`[temporal-worker] polling task queue: ${TASK_QUEUE}`);

  await worker.run();
}

main().catch((err) => {
  console.error("[temporal-worker] fatal:", err);
  process.exit(1);
});
