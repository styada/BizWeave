import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  consentEmail: z.boolean().optional(),
  consentSms: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().max(80).optional(),
});

const bulkSchema = z.object({ contacts: z.array(contactSchema).max(5000) });

async function requireBusiness(id: string, userId: string) {
  return db.business.findFirst({ where: { id, userId }, select: { id: true } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await requireBusiness(id, session.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contacts = await db.contact.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return NextResponse.json({ contacts });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await requireBusiness(id, session.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const bulk = bulkSchema.safeParse(body);
    const single = contactSchema.safeParse(body);
    const list = bulk.success ? bulk.data.contacts : single.success ? [single.data] : null;
    if (!list) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    let created = 0;
    for (const c of list) {
      if (!c.email && !c.phone) continue;
      await db.contact.upsert({
        where: { businessId_email: { businessId: id, email: c.email ?? `no-email-${c.phone}` } },
        create: {
          businessId: id,
          name: c.name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          consentEmail: c.consentEmail ?? false,
          consentSms: c.consentSms ?? false,
          tags: c.tags ?? undefined,
          source: c.source ?? "manual",
        },
        update: {
          name: c.name ?? undefined,
          phone: c.phone ?? undefined,
          consentEmail: c.consentEmail,
          consentSms: c.consentSms,
        },
      });
      created += 1;
    }
    return NextResponse.json({ ok: true, created });
  } catch (error) {
    console.error("Contacts error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
