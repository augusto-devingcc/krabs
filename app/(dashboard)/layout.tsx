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
    // `app-shell` scopes the shadcn/neutral OKLCH tokens to the dashboard
    // tree (see app/globals.css).  `dark` enables `dark:` Tailwind variants
    // used by shadcn primitives.  Switching to light mode is a one-class
    // change here (e.g. `app-shell light`) once we wire a theme toggle.
    <div className="app-shell dark min-h-screen flex">
      <Sidebar />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
