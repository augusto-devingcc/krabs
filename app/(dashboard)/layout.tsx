import { getDashboardContext } from "../../src/lib/web/dashboard-ctx.js";
import { DashboardChrome } from "@/components/dashboard/DashboardChrome";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves Clerk auth, syncs/creates the account row, and provisions
  // a "Web Dashboard" API key on first signup. Throws/redirects on auth
  // failure — child pages can assume an authenticated context exists.
  await getDashboardContext();
  return <DashboardChrome>{children}</DashboardChrome>;
}
