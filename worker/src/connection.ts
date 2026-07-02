/**
 * Temporal worker connection helpers.
 *
 * One Temporal client per process is the recommended pattern; we cache it
 * on globalThis so Next.js dev mode (HMR) doesn't open a new connection on
 * every file change.
 */
import { Client, Connection } from "@temporalio/client";

declare global {
  // eslint-disable-next-line no-var
  var __temporalClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __temporalConnectionPromise: Promise<Connection> | undefined;
}

export function getTemporalAddress(): string {
  return process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
}

export async function getTemporalConnection(): Promise<Connection> {
  if (!globalThis.__temporalConnectionPromise) {
    globalThis.__temporalConnectionPromise = Connection.connect({
      address: getTemporalAddress(),
    });
  }
  return globalThis.__temporalConnectionPromise;
}

export async function getTemporalClient(): Promise<Client> {
  if (!globalThis.__temporalClient) {
    globalThis.__temporalClient = new Client({
      connection: await getTemporalConnection(),
      namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    });
  }
  return globalThis.__temporalClient!;
}

/** Task queue used by the Bizweave worker. */
export const TASK_QUEUE = "bizweave-operator";
