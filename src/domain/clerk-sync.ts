import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { accounts } from "../db/schema.js";
import { newId } from "../contract/ids.js";

/**
 * Find-or-create an account for a Clerk user.
 *
 * Resolution order:
 *   1) by clerk_user_id (returning user)
 *   2) by email (legacy / seed accounts that haven't been linked yet)
 *      → link them by setting clerk_user_id
 *   3) create a brand-new account
 */
export async function resolveAccountForClerkUser(args: {
  clerkUserId: string;
  email: string;
  name?: string | null;
}) {
  const byClerk = await db
    .select()
    .from(accounts)
    .where(eq(accounts.clerkUserId, args.clerkUserId))
    .limit(1)
    .then((r) => r[0]);
  if (byClerk) return byClerk;

  const byEmail = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, args.email))
    .limit(1)
    .then((r) => r[0]);
  if (byEmail) {
    await db
      .update(accounts)
      .set({ clerkUserId: args.clerkUserId, name: args.name ?? byEmail.name })
      .where(eq(accounts.id, byEmail.id));
    return { ...byEmail, clerkUserId: args.clerkUserId, name: args.name ?? byEmail.name };
  }

  const id = newId("account");
  const now = new Date().toISOString();
  await db.insert(accounts).values({
    id,
    email: args.email,
    name: args.name ?? null,
    clerkUserId: args.clerkUserId,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    email: args.email,
    name: args.name ?? null,
    clerkUserId: args.clerkUserId,
    createdAt: now,
    updatedAt: now,
  };
}
