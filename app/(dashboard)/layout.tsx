import { getDashboardContext } from "../../src/lib/web/dashboard-ctx.js";
import { DashboardChrome } from "@/components/dashboard/DashboardChrome";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves the current operator. Hosted = Clerk session → account row.
  // Self-host = the single local-operator account from `pnpm setup`. Either
  // way, child pages can assume an authenticated context.
  const { clerkName, clerkEmail } = await getDashboardContext();
  const workspaceName = (
    clerkName?.split(/\s+/)[0] ?? clerkEmail.split("@")[0] ?? "workspace"
  ).toLowerCase();
  return <DashboardChrome workspaceName={workspaceName}>{children}</DashboardChrome>;
}
