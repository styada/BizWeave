import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

/**
 * Provision or update a Bizweave User row from a Supabase OAuth user.
 *
 * Three cases:
 *  (a) User already exists and is linked to this Supabase account
 *      (supabaseAuthId match) -> return existing user.
 *  (b) User exists with the same email but isn't linked -> link them.
 *  (c) New user -> create with a random unguessable password hash.
 *
 * Returns the Bizweave User row.
 */
export async function provisionUserFromSupabase(params: {
  supabaseId: string;
  email: string;
  fullName?: string | null;
}): Promise<{ id: string; email: string; name: string | null }> {
  const email = params.email.toLowerCase();

  // (a) already linked
  const linked = await db.user.findUnique({
    where: { supabaseAuthId: params.supabaseId },
  });
  if (linked) {
    return { id: linked.id, email: linked.email, name: linked.name };
  }

  // (b) email match -> link
  const byEmail = await db.user.findUnique({ where: { email } });
  if (byEmail) {
    const updated = await db.user.update({
      where: { id: byEmail.id },
      data: {
        supabaseAuthId: params.supabaseId,
        name: byEmail.name ?? params.fullName ?? null,
      },
    });
    return { id: updated.id, email: updated.email, name: updated.name };
  }

  // (c) new user with random unguessable password
  const randomHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const created = await db.user.create({
    data: {
      email,
      passwordHash: randomHash,
      name: params.fullName ?? null,
      supabaseAuthId: params.supabaseId,
    },
  });
  return { id: created.id, email: created.email, name: created.name };
}
