import { complete } from "@/lib/llm/client";
import { resolveLlm } from "@/lib/llm/resolve";
import { parseJson, fallbackSite } from "@/lib/agents/fallback";
import type { BusinessContext, SiteOutput } from "@/lib/agents/types";
import type { AgentTaskResult } from "@/lib/types/agent-task";

/**
 * The "inline" harness — an LLM-driven executor that runs in-process (no
 * sandbox). Used when no Claude/opencode harness is available or the task is
 * light. Degrades to deterministic templates when no LLM key is configured.
 */

/** Build a richer multi-section marketing website. */
export async function buildWebsite(
  ctx: BusinessContext,
  userId: string
): Promise<{ site: SiteOutput; usedFallback: boolean; costUsd: number }> {
  const llm = await resolveLlm(userId);
  if (!llm) {
    return { site: fallbackSite(ctx), usedFallback: true, costUsd: 0 };
  }

  const prompt = `You are an expert web designer building a conversion-focused, mobile-first, accessible (WCAG AA) marketing website for a physical local business. Return STRICT JSON with keys: html (string, body inner HTML only — semantic sections: hero, offerings, about, hours/location, testimonials, contact/CTA), css (string, dark-premium theme, responsive), meta {title, description}.

Business:
${JSON.stringify(
    {
      name: ctx.name,
      type: ctx.type,
      tagline: ctx.tagline,
      description: ctx.description,
      location: ctx.location,
      phone: ctx.phone,
      email: ctx.email,
      products: ctx.inventory.slice(0, 20),
    },
    null,
    2
  )}

Return ONLY the JSON object.`;

  try {
    const res = await complete(
      [
        { role: "system", content: "You output only valid JSON. No prose." },
        { role: "user", content: prompt },
      ],
      { provider: llm.provider, apiKey: llm.apiKey, maxTokens: 4096, temperature: 0.6 }
    );
    const site = parseJson<SiteOutput>(res.content, fallbackSite(ctx));
    // Basic validity guard.
    if (!site.html || !site.css) {
      return { site: fallbackSite(ctx), usedFallback: true, costUsd: 0.01 };
    }
    return { site, usedFallback: false, costUsd: estimateCost(res.content.length) };
  } catch {
    return { site: fallbackSite(ctx), usedFallback: true, costUsd: 0 };
  }
}

/** Generic planning/execution for open-ended goals with no dedicated handler. */
export async function runGenericGoal(
  goal: string,
  ctx: BusinessContext,
  userId: string
): Promise<AgentTaskResult> {
  const llm = await resolveLlm(userId);
  if (!llm) {
    return {
      ok: true,
      summary: `Planned (demo mode, no LLM key): ${goal}. Add an API key to execute deeply.`,
      costUsd: 0,
    };
  }
  try {
    const res = await complete(
      [
        {
          role: "system",
          content:
            "You are an autonomous operator for a local business. Produce a concise, actionable plan and note any steps that require owner approval (spend, sending, publishing).",
        },
        {
          role: "user",
          content: `Business: ${ctx.name} (${ctx.type}). Goal: ${goal}`,
        },
      ],
      { provider: llm.provider, apiKey: llm.apiKey, maxTokens: 1200, temperature: 0.5 }
    );
    return {
      ok: true,
      summary: res.content.slice(0, 4000),
      costUsd: estimateCost(res.content.length),
    };
  } catch (err) {
    return {
      ok: false,
      summary: `Failed: ${err instanceof Error ? err.message : String(err)}`,
      costUsd: 0,
    };
  }
}

/** Rough token/cost estimate for metering (chars/4 tokens, ~$1/M blended). */
function estimateCost(chars: number): number {
  const tokens = chars / 4;
  return Number(((tokens / 1_000_000) * 1.0).toFixed(6));
}
