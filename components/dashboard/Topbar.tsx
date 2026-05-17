"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Moon, Search, Sun } from "lucide-react";
import { useMarketingTheme } from "@/components/marketing/theme-context";

// UserButton is loaded only when Clerk is configured. In self-host mode
// (no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) the Clerk SDK throws at import
// time, so the import is gated dynamically.
const ClerkUserButton =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? dynamic(
        () => import("@clerk/nextjs").then((m) => m.UserButton),
        { ssr: false },
      )
    : null;

const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/contacts": "Contacts",
  "/dashboard/deals": "Deals",
  "/dashboard/tasks": "Tasks",
  "/dashboard/notes": "Notes",
  "/dashboard/tags": "Tags",
  "/dashboard/audit": "Audit log",
  "/dashboard/keys": "API keys",
  "/dashboard/finance": "Money",
  "/dashboard/billing": "Billing",
  "/dashboard/settings": "Settings",
};

function humanize(segment: string): string {
  if (!segment) return "Dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

function resolveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  // longest-prefix match — handles /dashboard/contacts/:id etc.
  const matches = Object.keys(TITLES)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length);
  const best = matches[0];
  if (best) return TITLES[best] ?? humanize(best);
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return humanize(last);
}

export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const pathname = usePathname();
  const title = resolveTitle(pathname);
  const { theme, toggleTheme } = useMarketingTheme();
  const isDark = theme === "dark";

  return (
    <header className="tb">
      <h1 className="tb__title">{title}</h1>

      <button
        className="tb__search"
        type="button"
        onClick={onOpenPalette}
        aria-label="Open command palette"
      >
        <Search size={13} aria-hidden />
        <span>Search</span>
        <span className="tb__search-kbd">
          <span className="k-kbd">⌘</span>
          <span className="k-kbd">K</span>
        </span>
      </button>

      <button
        className="tb__theme"
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}
      >
        {isDark ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
      </button>

      <span className="tb__user">
        {ClerkUserButton ? (
          <ClerkUserButton
            appearance={{ elements: { avatarBox: "h-[22px] w-[22px]" } }}
          />
        ) : (
          <span className="tb__user-local" title="Self-host · local operator">●</span>
        )}
      </span>
    </header>
  );
}
