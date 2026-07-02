import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaceSummary, ensureWorkspace } from "@/lib/workspace";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.workspaceMember.findMany({
    where: { userId: session.id },
    select: { workspaceId: true },
  });
  const ids = memberships.map((m) => m.workspaceId);
  const workspaces = await Promise.all(ids.map((id) => workspaceSummary(id)));
  return NextResponse.json({ workspaces: workspaces.filter(Boolean) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { businessId?: string; name?: string };
  if (!body.businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  const business = await db.business.findFirst({
    where: { id: body.businessId, userId: session.id },
    select: { id: true, name: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workspaceId = await ensureWorkspace(session.id, business.id, body.name ?? `${business.name} Workspace`);
  const summary = await workspaceSummary(workspaceId);
  return NextResponse.json({ workspace: summary });
}
