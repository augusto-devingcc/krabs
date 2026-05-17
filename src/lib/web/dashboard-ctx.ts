import "server-only";
import { redirect } from "next/navigation";
import { resolveAccountForClerkUser, type ResolvedAccount } from "../../domain/clerk-sync.js";
import { isSelfHostMode, resolveSelfHostAccount } from "./self-host.js";

/**
 * Single source of truth for "who is the current dashboard user".
 * Server components & server actions call this, get a CallerContext for
 * direct domain calls (no HTTP roundtrip), and never see the API key
 * plaintext (only its id, used as actor in agent_actions).
 *
 * Two modes:
 *   - Hosted (CLERK_SECRET_KEY present): Clerk session → account row
 *   - Self-host (no CLERK_SECRET_KEY): single local operator, no auth
 */
export async function getDashboardContext(): Promise<{
  ctx: { accountId: string; apiKeyId: string };
  account: ResolvedAccount;
  clerkUserId: string | null;
  clerkEmail: string;
  clerkName: string | null;
}> {
  if (isSelfHostMode()) {
    const account = await resolveSelfHostAccount();
    return {
      ctx: { accountId: account.id, apiKeyId: account.dashboardApiKeyId },
      account,
      clerkUserId: null,
      clerkEmail: account.email,
      clerkName: account.name,
    };
  }

  // Hosted: import Clerk lazily so self-host builds don't pay for it at
  // module-eval time and so a missing CLERK_SECRET_KEY in dev doesn't blow
  // up before we get the chance to fall through to the self-host branch.
  const { auth, currentUser } = await import("@clerk/nextjs/server");

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
