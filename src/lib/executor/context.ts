import { db } from "@/lib/db";
import type { BusinessContext } from "@/lib/agents/types";

/** Load a BusinessContext (used by agents + harnesses) from the DB. */
export async function loadBusinessContext(
  businessId: string
): Promise<BusinessContext | null> {
  const b = await db.business.findUnique({
    where: { id: businessId },
    include: { inventory: { take: 50 } },
  });
  if (!b) return null;
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    tagline: b.tagline,
    description: b.description,
    location: b.location,
    phone: b.phone,
    email: b.email,
    inventory: b.inventory.map((i) => ({
      name: i.name,
      sku: i.sku,
      price: i.price,
      quantity: i.quantity,
      category: i.category,
    })),
  };
}
