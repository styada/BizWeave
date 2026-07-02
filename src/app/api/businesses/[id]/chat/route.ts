import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleOperatorMessage } from "@/lib/chat/operator";
import { z } from "zod";

const chatSchema = z.object({
  text: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  const conversation = conversationId
    ? await db.conversation.findFirst({
        where: { id: conversationId, businessId: id },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
      })
    : await db.conversation.findFirst({
        where: { businessId: id },
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
      });

  return NextResponse.json({ conversation });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const result = await handleOperatorMessage({
      businessId: id,
      userId: session.id,
      text: parsed.data.text,
      conversationId: parsed.data.conversationId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
