"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TREE: Array<{
  head: string;
  items: Array<{ href: string; label: string; badge?: string }>;
}> = [
  {
    head: "getting started",
    items: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/install", label: "Install" },
      { href: "/docs/quickstart", label: "Quickstart", badge: "start here" },
      { href: "/docs/auth", label: "Auth & tokens" },
    ],
  },
  {
    head: "deployment",
    items: [
      { href: "/docs/self-hosting", label: "Self-hosting" },
    ],
  },
  {
    head: "interfaces",
    items: [
      { href: "/docs/contract", label: "The contract" },
    ],
  },
  {
    head: "finance",
    items: [{ href: "/docs/finance", label: "Finance reporting" }],
  },
  {
    head: "for agents",
    items: [{ href: "/docs/skill", label: "Agent skill", badge: "new" }],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <aside className="ds">
      {TREE.map((section) => (
        <div className="ds__sec" key={section.head}>
          <div className="ds__head">{section.head}</div>
          {section.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`ds__item${active ? " on" : ""}`}
              >
                <span>{item.label}</span>
                {item.badge && <span className="ds__badge">{item.badge}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
