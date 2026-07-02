import type { BusinessContext, SiteOutput } from "@/lib/agents/types";
import { fallbackSite } from "@/lib/agents/fallback";
import { backlinkHtml } from "@/lib/sites/backlink";

export type TemplateId = "classic" | "minimal" | "bold";

/**
 * Fast free-tier template engine: form-filled, subdomain-hosted sites without
 * LLM cost. Uses deterministic templates + business data from onboarding.
 */
export function buildTemplateSite(
  ctx: BusinessContext,
  templateId: TemplateId = "classic",
  opts?: { includeBacklink?: boolean; hours?: Record<string, string> | null }
): SiteOutput {
  const base = fallbackSite(ctx);
  const hoursBlock = formatHours(opts?.hours);

  if (templateId === "minimal") {
    base.css = base.css.replace(/#e8b84a/g, "#7c5cff");
  }
  if (templateId === "bold") {
    base.css += `
      .hero { background: linear-gradient(135deg, #7c5cff 0%, #0a0b0f 60%); }
      .hero h1 { font-size: 3rem; }
    `;
  }

  if (hoursBlock) {
    base.html = base.html.replace(
      "</section>\n    <section id=\"contact\"",
      `</section>\n    <section id="hours" class="hours"><h2>Hours</h2>${hoursBlock}</section>\n    <section id="contact"`
    );
  }

  if (opts?.includeBacklink !== false) {
    base.html = base.html.replace(/<footer>[\s\S]*<\/footer>/, backlinkHtml());
  }

  base.meta = {
    ...base.meta,
    templateId,
    tier: "free",
  };
  return base;
}

function formatHours(hours: unknown): string {
  if (!hours || typeof hours !== "object") return "";
  const entries = Object.entries(hours as Record<string, string>);
  if (entries.length === 0) return "";
  return `<ul>${entries.map(([d, h]) => `<li><strong>${d}</strong>: ${h}</li>`).join("")}</ul>`;
}

export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
