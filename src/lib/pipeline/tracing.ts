import { optionalEnv } from "@/lib/env";

/**
 * LangSmith tracing seam. When LANGSMITH_API_KEY + LANGCHAIN_TRACING_V2 are set,
 * `traced()` wraps a node run so it appears as a span. We avoid a hard dependency
 * on the langsmith package: if it isn't installed, we degrade to a no-op wrapper
 * (the run still works, just untraced).
 */
export function tracingEnabled(): boolean {
  return (
    !!optionalEnv("LANGSMITH_API_KEY") &&
    (optionalEnv("LANGCHAIN_TRACING_V2") ?? "").toLowerCase() === "true"
  );
}

export async function traced<T>(
  name: string,
  meta: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  if (!tracingEnabled()) return fn();
  const started = Date.now();
  try {
    const result = await fn();
    await postRun(name, meta, "success", Date.now() - started).catch(() => undefined);
    return result;
  } catch (err) {
    await postRun(name, { ...meta, error: String(err) }, "error", Date.now() - started).catch(
      () => undefined
    );
    throw err;
  }
}

async function postRun(
  name: string,
  meta: Record<string, unknown>,
  status: string,
  ms: number
): Promise<void> {
  const key = optionalEnv("LANGSMITH_API_KEY");
  if (!key) return;
  // Minimal LangSmith runs API call; ignored if endpoint/project unavailable.
  await fetch("https://api.smith.langchain.com/runs", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      run_type: "chain",
      inputs: meta,
      outputs: { status, ms },
      session_name: optionalEnv("LANGCHAIN_PROJECT") ?? "bizweave",
      start_time: new Date(Date.now() - ms).toISOString(),
      end_time: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}
