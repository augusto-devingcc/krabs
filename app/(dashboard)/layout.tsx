import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { resolveAccountForClerkUser } from "../../src/domain/clerk-sync.js";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/sign-in");

  // Ensure our internal account row exists for this Clerk user.
  await resolveAccountForClerkUser({
    clerkUserId: userId,
    email,
    name: user.firstName ?? user.fullName ?? null,
  });

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
