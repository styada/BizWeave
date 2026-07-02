#!/usr/bin/env node
/**
 * Seed the internal Bizweave dogfood business (Section 9).
 * Run after db:push: node scripts/seed-dogfood.mjs
 */
import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DOGFOOD_EMAIL = "ops@bizweave.site";
const DOGFOOD_NAME = "Bizweave";

async function main() {
  let user = await db.user.findUnique({ where: { email: DOGFOOD_EMAIL } });
  if (!user) {
    user = await db.user.create({
      data: {
        email: DOGFOOD_EMAIL,
        name: "Bizweave Ops",
        passwordHash: "dogfood-seed-not-for-login",
      },
    });
    console.log("Created dogfood user:", user.id);
  }

  let business = await db.business.findFirst({
    where: { userId: user.id, name: DOGFOOD_NAME },
  });
  if (!business) {
    business = await db.business.create({
      data: {
        userId: user.id,
        name: DOGFOOD_NAME,
        type: "saas",
        tagline: "Your business, woven online while you sleep",
        description:
          "Bizweave is an autonomous AI operator for local businesses. We run our own marketing on Bizweave.",
        location: "Remote",
        email: DOGFOOD_EMAIL,
        status: "active",
      },
    });
    console.log("Created dogfood business:", business.id);
  }

  await db.subscription.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      tier: "operator1500",
      status: "active",
      entitlements: { tier: "operator1500" },
    },
    update: { tier: "operator1500", status: "active" },
  });

  console.log("Dogfood seed complete. Business ID:", business.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
