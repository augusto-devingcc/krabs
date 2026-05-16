"use client";

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

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

export function Topbar() {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="tb">
      <h1 className="tb__title">{title}</h1>

      <button
        className="tb__search"
        type="button"
        disabled
        aria-label="Search (coming soon)"
      >
        <Search size={13} aria-hidden />
        <span>Search</span>
        <span className="tb__search-kbd">
          <span className="k-kbd">⌘</span>
          <span className="k-kbd">K</span>
        </span>
      </button>

      <span className="tb__user">
        <UserButton
          appearance={{ elements: { avatarBox: "h-[22px] w-[22px]" } }}
        />
      </span>
    </header>
  );
}
