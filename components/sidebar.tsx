"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  BadgeDollarSign,
  CheckSquare,
  StickyNote,
  Tag,
  History,
  KeyRound,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { BRAND } from "@/lib/brand.js";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/components/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavSection = { title: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    title: "Activity",
    items: [
      { href: "/dashboard", label: "overview", icon: LayoutDashboard },
      { href: "/dashboard/audit", label: "audit log", icon: History },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/dashboard/contacts", label: "contacts", icon: Users },
      { href: "/dashboard/deals", label: "deals", icon: BadgeDollarSign },
      { href: "/dashboard/tasks", label: "tasks", icon: CheckSquare },
      { href: "/dashboard/notes", label: "notes", icon: StickyNote },
      { href: "/dashboard/tags", label: "tags", icon: Tag },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/dashboard/keys", label: "api keys", icon: KeyRound },
      { href: "/dashboard/billing", label: "billing", icon: CreditCard },
      { href: "/dashboard/settings", label: "settings", icon: Settings },
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
    <aside className="w-60 shrink-0 border-r border-border flex flex-col bg-background">
      {/* Brand wordmark */}
      <div className="px-5 py-5 border-b border-border">
        <Link
          href="/dashboard"
          className="font-mono text-foreground text-base lowercase tracking-tight inline-flex items-baseline gap-1.5"
        >
          <span className="text-muted-foreground">›</span>
          <span>{BRAND.name}</span>
        </Link>
      </div>

      {/* Sectioned nav */}
      <nav className="flex-1 overflow-y-auto py-4 text-sm">
        {sections.map((section, sIdx) => (
          <div key={section.title} className={sIdx === 0 ? "" : "mt-5"}>
            <p className="px-5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {section.title}
            </p>
            <ul className="flex flex-col gap-px px-2">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-2.5 pl-[14px] pr-3 py-1.5 rounded-md transition-colors",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-foreground"
                        />
                      )}
                      <Icon
                        aria-hidden
                        size={16}
                        className={cn(
                          active
                            ? "text-accent-foreground"
                            : "text-muted-foreground",
                        )}
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <Separator />

      {/* Footer: signed-in identity + Clerk UserButton */}
      <div className="px-5 py-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-0.5">
            signed in as
          </p>
          <p
            className="font-mono text-xs text-muted-foreground truncate"
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
