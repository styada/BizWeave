import { db } from "@/lib/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushMessage = { title: string; body: string; data?: Record<string, unknown> };

/**
 * Send an Expo push notification to every registered device for a user.
 * No-ops gracefully when the user has no tokens or Expo is unreachable.
 */
export async function pushToUser(userId: string, message: PushMessage): Promise<{ sent: number }> {
  const tokens = await db.pushToken.findMany({ where: { userId }, select: { token: true } });
  if (tokens.length === 0) return { sent: 0 };

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: "default",
    title: message.title,
    body: message.body,
    data: message.data ?? {},
  }));

  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
    return { sent: messages.length };
  } catch {
    return { sent: 0 };
  }
}

/** Notify the owner of a business (looks up userId from the business). */
export async function pushToBusinessOwner(
  businessId: string,
  message: PushMessage
): Promise<{ sent: number }> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { userId: true },
  });
  if (!business) return { sent: 0 };
  return pushToUser(business.userId, message);
}
