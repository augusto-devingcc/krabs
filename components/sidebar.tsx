"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { BRAND } from "@/lib/brand.js";

const nav = [
  { href: "/dashboard", label: "overview" },
  { href: "/dashboard/contacts", label: "contacts" },
  { href: "/dashboard/deals", label: "deals" },
  { href: "/dashboard/tasks", label: "tasks" },
  { href: "/dashboard/notes", label: "notes" },
  { href: "/dashboard/tags", label: "tags" },
  { href: "/dashboard/audit", label: "audit log" },
  { href: "/dashboard/keys", label: "api keys" },
  { href: "/dashboard/billing", label: "billing" },
  { href: "/dashboard/settings", label: "settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <Link
          href="/dashboard"
          className="font-mono text-[var(--color-accent)] text-base lowercase"
        >
          {BRAND.name}
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 text-sm">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-1.5 rounded-[var(--radius-sm)] transition-colors ${
                active
                  ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-[var(--color-border)]">
        <UserButton />
      </div>
    </aside>
  );
}
