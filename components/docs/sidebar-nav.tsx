"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/lib/utils";

type NavItem = { title: string; href: string };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    title: "Get started",
    items: [
      { title: "Introduction", href: "/docs" },
      { title: "Getting started", href: "/docs/getting-started" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { title: "Agent contract", href: "/docs/concepts/agent-contract" },
      { title: "Audit log", href: "/docs/concepts/audit-log" },
      {
        title: "Multi-channel identity",
        href: "/docs/concepts/multi-channel-identity",
      },
    ],
  },
  {
    title: "Reference",
    items: [{ title: "API reference", href: "/docs/api-reference" }],
  },
  {
    title: "Cookbook",
    items: [{ title: "Recipes", href: "/docs/recipes" }],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1.5">
          <p className="px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
