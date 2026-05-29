import { z } from "zod";

export const intakeSchema = z.object({
  persona: z.string().min(3),
  valueProps: z.array(z.string().min(2)).min(1),
  tone: z.string().min(2),
  competitorHints: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
});

export const plannerSchema = z.object({
  siteStructure: z.object({
    pages: z
      .array(
        z.object({
          slug: z.string().min(1),
          title: z.string().min(1),
          sections: z.array(z.string().min(1)).min(1),
        })
      )
      .min(1),
    primaryCTA: z.string().min(1),
    colorMood: z.string().min(1),
  }),
  contentThemes: z.array(z.string().min(1)).min(1),
  marketingAngles: z.array(z.string().min(1)).min(1),
  timeline: z.array(
    z.object({
      phase: z.string().min(1),
      duration: z.string().min(1),
      actions: z.array(z.string().min(1)).min(1),
    })
  ),
});

export const siteSchema = z.object({
  html: z.string().min(20),
  css: z.string().min(20),
  meta: z.object({
    title: z.string().min(2),
    description: z.string().min(2),
  }),
});

export const marketingSchema = z.object({
  channels: z.array(z.string().min(2)).min(1),
  campaigns: z
    .array(
      z.object({
        name: z.string().min(2),
        channel: z.string().min(2),
        content: z.string().min(4),
        schedule: z.string().optional(),
      })
    )
    .min(1),
  seoKeywords: z.array(z.string().min(2)).min(3),
});

export const supportSchema = z.object({
  faqs: z
    .array(
      z.object({
        question: z.string().min(4),
        answer: z.string().min(4),
      })
    )
    .min(1),
  autoReplies: z
    .array(
      z.object({
        trigger: z.string().min(2),
        response: z.string().min(4),
      })
    )
    .min(1),
  escalationRules: z.array(z.string().min(2)).min(1),
});

export const safeguardSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()).default([]),
  revisions: z.array(z.string()).default([]),
  summary: z.string().min(4),
  reliabilityIndex: z.number().int().min(0).max(100),
  scores: z.object({
    safety: z.number().int().min(0).max(100),
    consistency: z.number().int().min(0).max(100),
    channelReadiness: z.number().int().min(0).max(100),
  }),
  differentiatorInsight: z.string().min(4),
});

type ParseResult<T> = {
  value: T;
  usedFallback: boolean;
};

function tryParseJson(raw: string): unknown {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    return undefined;
  }
}

export function parseWithSchema<T>(
  raw: string,
  schema: z.ZodType<T>,
  fallback: T
): ParseResult<T> {
  try {
    const parsed = tryParseJson(raw);
    if (!parsed) {
      return { value: fallback, usedFallback: true };
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return { value: fallback, usedFallback: true };
    }
    return { value: result.data, usedFallback: false };
  } catch {
    return { value: fallback, usedFallback: true };
  }
}
