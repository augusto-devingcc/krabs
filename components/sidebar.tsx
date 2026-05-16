"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { BRAND } from "@/lib/brand.js";

type NavItem = { href: string; label: string };
type NavSection = { title: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    title: "Activity",
    items: [
      { href: "/dashboard", label: "overview" },
      { href: "/dashboard/audit", label: "audit log" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/dashboard/contacts", label: "contacts" },
      { href: "/dashboard/deals", label: "deals" },
      { href: "/dashboard/tasks", label: "tasks" },
      { href: "/dashboard/notes", label: "notes" },
      { href: "/dashboard/tags", label: "tags" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/dashboard/keys", label: "api keys" },
      { href: "/dashboard/billing", label: "billing" },
      { href: "/dashboard/settings", label: "settings" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg)]">
      {/* Brand wordmark */}
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <Link
          href="/dashboard"
          className="font-mono text-[var(--color-fg)] text-base lowercase tracking-tight inline-flex items-baseline gap-1.5"
        >
          <span className="text-[var(--color-fg-faint)]">›</span>
          <span>{BRAND.name}</span>
        </Link>
      </div>

      {/* Sectioned nav */}
      <nav className="flex-1 overflow-y-auto py-4 text-sm">
        {sections.map((section, sIdx) => (
          <div key={section.title} className={sIdx === 0 ? "" : "mt-5"}>
            <p className="px-5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-faint)]">
              {section.title}
            </p>
            <ul className="px-2 space-y-px">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`relative block pl-[14px] pr-3 py-1.5 rounded-[var(--radius-sm)] transition-colors ${
                        active
                          ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[var(--color-fg)]"
                        />
                      )}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: signed-in identity + Clerk UserButton */}
      <div className="border-t border-[var(--color-border)] px-5 py-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-faint)] mb-0.5">
            signed in as
          </p>
          <p
            className="font-mono text-xs text-[var(--color-fg-muted)] truncate"
            title={email}
          >
            {email || "—"}
          </p>
        </div>
        <UserButton />
      </div>
    </aside>
  );
}
