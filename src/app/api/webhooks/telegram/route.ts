import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleOperatorMessage } from "@/lib/chat/operator";
import { sendTelegram } from "@/lib/notify/telegram";
import { optionalEnv } from "@/lib/env";

/**
 * Telegram bridge. Owners link a chat by DMing the bot; a MessagingBridge row
 * maps the chat id to a business. Inbound text is routed through the operator
 * and the reply is sent back to the same chat.
 */
export async function POST(request: Request) {
  const secret = optionalEnv("TELEGRAM_WEBHOOK_SECRET");
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = (await request.json()) as {
      message?: { chat?: { id?: number }; text?: string };
    };
    const chatId = update.message?.chat?.id?.toString();
    const text = update.message?.text?.trim();
    if (!chatId || !text) return NextResponse.json({ ok: true });

    const bridge = await db.messagingBridge.findUnique({
      where: { provider_externalId: { provider: "telegram", externalId: chatId } },
      include: { business: { select: { id: true, userId: true } } },
    });

    if (!bridge) {
      await sendTelegram(
        chatId,
        "This chat isn't linked to a Bizweave business yet. Link it from your dashboard to start operating by chat."
      );
      return NextResponse.json({ ok: true });
    }

    const reply = await handleOperatorMessage({
      businessId: bridge.business.id,
      userId: bridge.business.userId,
      text,
      channel: "telegram",
    });
    await sendTelegram(chatId, reply.reply);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
