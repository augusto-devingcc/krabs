import "server-only";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { resolveAccountForClerkUser, type ResolvedAccount } from "../../domain/clerk-sync.js";

/**
 * Single source of truth for "who is the current dashboard user".
 * Server components & server actions call this, get a CallerContext for
 * direct domain calls (no HTTP roundtrip), and never see the API key
 * plaintext (only its id, used as actor in agent_actions).
 */
export async function getDashboardContext(): Promise<{
  ctx: { accountId: string; apiKeyId: string };
  account: ResolvedAccount;
  clerkUserId: string;
  clerkEmail: string;
  clerkName: string | null;
}> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/sign-in");

  const account = await resolveAccountForClerkUser({
    clerkUserId: userId,
    email,
    name: user.firstName ?? user.fullName ?? null,
  });

  return {
    ctx: { accountId: account.id, apiKeyId: account.dashboardApiKeyId },
    account,
    clerkUserId: userId,
    clerkEmail: email,
    clerkName: user.firstName ?? user.fullName ?? null,
  };
}
