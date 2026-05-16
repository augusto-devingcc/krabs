"use client";

import Link from "next/link";
import Image from "next/image";
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
import { cn } from "@/components/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavSection = { title?: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/audit", label: "Audit log", icon: History },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/dashboard/contacts", label: "Contacts", icon: Users },
      { href: "/dashboard/deals", label: "Deals", icon: BadgeDollarSign },
      { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/dashboard/notes", label: "Notes", icon: StickyNote },
      { href: "/dashboard/tags", label: "Tags", icon: Tag },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/dashboard/keys", label: "API keys", icon: KeyRound },
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
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
  const workspaceName = user?.firstName
    ? user.firstName.toLowerCase()
    : (email.split("@")[0] ?? "workspace");

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-sidebar border-r border-border">
      <div className="px-3 pt-3 pb-3.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          <Image
            src="/brand/logo-mark.svg"
            alt=""
            width={22}
            height={22}
            className="rounded-[5px] shrink-0"
          />
          <span className="flex-1 min-w-0 flex items-baseline gap-1.5 text-[13px] leading-none text-foreground">
            <span className="font-mono font-semibold">{BRAND.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate text-muted-foreground">
              {workspaceName}
            </span>
          </span>
          <span
            aria-hidden
            className="text-[10px] text-muted-foreground shrink-0"
          >
            ▾
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.map((section, sIdx) => (
          <div
            key={section.title ?? `group-${sIdx}`}
            className={cn(
              "flex flex-col gap-px",
              sIdx === 0
                ? ""
                : "mt-4 pt-4 border-t border-border/60",
            )}
          >
            {section.title && (
              <p className="k-eyebrow px-2 pb-1.5 text-muted-foreground">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-2.5 h-7 pl-2.5 pr-2 rounded-md text-[13px] transition-colors",
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary"
                    />
                  )}
                  <Icon
                    aria-hidden
                    size={15}
                    strokeWidth={1.75}
                    className={cn(
                      "shrink-0 transition-colors",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-2.5 flex items-center gap-2.5">
        <UserButton
          appearance={{ elements: { avatarBox: "h-7 w-7" } }}
        />
        <div className="min-w-0 flex-1">
          <p
            className="font-mono text-[11px] text-foreground truncate leading-tight"
            title={email}
          >
            {email || "—"}
          </p>
          <p className="k-caption text-muted-foreground leading-tight">
            {BRAND.productName}
          </p>
        </div>
      </div>
    </aside>
  );
}
