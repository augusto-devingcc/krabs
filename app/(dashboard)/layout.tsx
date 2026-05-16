import { getDashboardContext } from "../../src/lib/web/dashboard-ctx.js";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves Clerk auth, syncs/creates the account row, and provisions
  // a "Web Dashboard" API key on first signup. Throws/redirects on auth
  // failure — child pages can assume an authenticated context exists.
  await getDashboardContext();
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
