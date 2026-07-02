import { db } from "@/lib/db";
import { entitlementsForTier, priceForBusinessAt } from "@/lib/billing/entitlements";
import type { Tier } from "@/lib/types/entitlements";

export type WorkspaceSummary = {
  id: string;
  name: string;
  businesses: { id: string; name: string; status: string; tier: string; monthlyUsd: number }[];
  totalMonthlyUsd: number;
};

/** Create a workspace for a user and attach a business. */
export async function ensureWorkspace(userId: string, businessId: string, name: string): Promise<string> {
  const business = await db.business.findUnique({ where: { id: businessId }, select: { workspaceId: true } });
  if (business?.workspaceId) return business.workspaceId;

  const ws = await db.workspace.create({
    data: {
      name,
      ownerUserId: userId,
      members: { create: { userId, role: "owner" } },
    },
  });
  await db.business.update({ where: { id: businessId }, data: { workspaceId: ws.id } });
  return ws.id;
}

/** Portfolio view with multi-business discount pricing. */
export async function workspaceSummary(workspaceId: string): Promise<WorkspaceSummary | null> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      businesses: {
        orderBy: { createdAt: "asc" },
        include: { subscription: { select: { tier: true } } },
      },
    },
  });
  if (!ws) return null;

  const businesses = ws.businesses.map((b, index) => {
    const tier = (b.subscription?.tier ?? "free") as Tier;
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      tier,
      monthlyUsd: priceForBusinessAt(tier, index),
    };
  });

  return {
    id: ws.id,
    name: ws.name,
    businesses,
    totalMonthlyUsd: businesses.reduce((s, b) => s + b.monthlyUsd, 0),
  };
}

/** RBAC: can this user access a business in the workspace? */
export async function canAccessBusiness(
  userId: string,
  businessId: string
): Promise<boolean> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { userId: true, workspaceId: true },
  });
  if (!business) return false;
  if (business.userId === userId) return true;
  if (!business.workspaceId) return false;

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: business.workspaceId, userId } },
  });
  if (!member) return false;
  if (!member.businessScope) return true;
  const scope = member.businessScope as string[];
  return scope.includes(businessId);
}

export { entitlementsForTier };
