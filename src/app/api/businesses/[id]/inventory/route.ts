import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { inventoryBulkSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
  });
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = inventoryBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid inventory" }, { status: 400 });
    }

    await db.inventoryItem.deleteMany({ where: { businessId: id } });
    await db.inventoryItem.createMany({
      data: parsed.data.items.map((item) => ({
        businessId: id,
        name: item.name,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        category: item.category,
      })),
    });

    const count = await db.inventoryItem.count({ where: { businessId: id } });
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    console.error("Inventory error:", error);
    return NextResponse.json({ error: "Failed to save inventory" }, { status: 500 });
  }
}
