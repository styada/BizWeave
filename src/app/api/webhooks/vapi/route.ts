import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Vapi webhook. On end-of-call reports, persist a CallLog with transcript,
 * duration, and outcome so calls surface in the dashboard.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      message?: {
        type?: string;
        call?: { id?: string; assistantId?: string; customer?: { number?: string } };
        durationSeconds?: number;
        transcript?: string;
        recordingUrl?: string;
        endedReason?: string;
      };
    };
    const m = payload.message;
    if (m?.type !== "end-of-call-report") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const agent = m.call?.assistantId
      ? await db.phoneAgent.findFirst({ where: { providerId: m.call.assistantId } })
      : null;
    if (!agent) return NextResponse.json({ ok: true, unmatched: true });

    await db.callLog.create({
      data: {
        businessId: agent.businessId,
        phoneAgentId: agent.id,
        direction: "inbound",
        fromNumber: m.call?.customer?.number ?? null,
        durationSec: m.durationSeconds ?? null,
        transcript: m.transcript ?? null,
        recordingUrl: m.recordingUrl ?? null,
        outcome: m.endedReason ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
