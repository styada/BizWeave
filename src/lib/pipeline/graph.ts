import { traced } from "@/lib/pipeline/tracing";

/**
 * Minimal durable DAG engine with LangGraph-style semantics:
 *  - nodes declare dependencies; independent nodes run in parallel (fan-out)
 *  - each node result is checkpointed via `onCheckpoint` (resumable)
 *  - a node may request human-in-the-loop by throwing `Interrupt`
 *  - LangSmith spans via `traced()`
 *
 * When @langchain/langgraph is installed AND desired, this can be swapped for
 * the real StateGraph; the surface (runGraph) stays the same.
 */
export class Interrupt extends Error {
  constructor(public readonly reason: string, public readonly payload?: unknown) {
    super(`INTERRUPT: ${reason}`);
    this.name = "Interrupt";
  }
}

export type GraphNode<S> = {
  id: string;
  deps: string[];
  run: (state: S) => Promise<Partial<S>>;
};

export type GraphResult<S> =
  | { status: "complete"; state: S }
  | { status: "interrupted"; reason: string; payload?: unknown; state: S };

export async function runGraph<S extends object>(params: {
  nodes: GraphNode<S>[];
  initialState: S;
  onCheckpoint?: (nodeId: string, state: S) => Promise<void>;
}): Promise<GraphResult<S>> {
  const { nodes } = params;
  let state = params.initialState;
  const done = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Topologically process in waves; each wave runs its ready nodes in parallel.
  while (done.size < nodes.length) {
    const ready = nodes.filter(
      (n) => !done.has(n.id) && n.deps.every((d) => done.has(d))
    );
    if (ready.length === 0) {
      throw new Error(
        `Graph deadlock: unresolved deps for ${nodes
          .filter((n) => !done.has(n.id))
          .map((n) => n.id)
          .join(", ")}`
      );
    }

    try {
      const results = await Promise.all(
        ready.map((n) =>
          traced(`node:${n.id}`, { node: n.id }, () => n.run(state))
        )
      );
      // Merge sequentially for deterministic state.
      ready.forEach((n, i) => {
        state = { ...state, ...results[i] };
      });
    } catch (err) {
      if (err instanceof Interrupt) {
        return { status: "interrupted", reason: err.reason, payload: err.payload, state };
      }
      throw err;
    }

    for (const n of ready) {
      done.add(n.id);
      await params.onCheckpoint?.(n.id, state);
    }
    void byId;
  }

  return { status: "complete", state };
}
