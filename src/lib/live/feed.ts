import { db } from "@/lib/db";

export type LiveEvent = {
  id: string;
  businessName: string;
  eventType: string;
  level: string;
  message: string;
  occurredAt: string;
};

/**
 * Public credibility feed (NanoCorp-style /live): anonymized activity stream of
 * agent successes across the fleet. No PII, no secrets.
 */
export async function getLiveFeed(limit = 30): Promise<LiveEvent[]> {
  const events = await db.activityEvent.findMany({
    where: {
      level: { in: ["info", "warn"] },
      eventType: { in: ["guard", "dreaming", "maintenance", "pipeline"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { business: { select: { name: true } } },
  });

  return events.map((e) => ({
    id: e.id,
    businessName: maskName(e.business?.name ?? "A local business"),
    eventType: e.eventType,
    level: e.level,
    message: sanitizeMessage(e.message),
    occurredAt: e.createdAt.toISOString(),
  }));
}

function maskName(name: string): string {
  if (name.length <= 3) return "***";
  return name.slice(0, 2) + "•".repeat(Math.min(6, name.length - 2));
}

function sanitizeMessage(msg: string): string {
  return msg.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]").slice(0, 200);
}
