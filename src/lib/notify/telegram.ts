import { optionalEnv } from "@/lib/env";

/** Send a Telegram message via the Bot API. No-ops without a bot token. */
export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const token = optionalEnv("TELEGRAM_BOT_TOKEN");
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
