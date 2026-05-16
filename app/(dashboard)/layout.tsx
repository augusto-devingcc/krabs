import { getDashboardContext } from "../../src/lib/web/dashboard-ctx.js";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/dashboard/Topbar";

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
    // Designer's app shell: .app > sidebar + .main (topbar + content).
    // Pages still handle their own internal padding/max-width.
    <div className="app min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="main">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
