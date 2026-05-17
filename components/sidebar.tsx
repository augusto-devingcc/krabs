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
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BRAND } from "@/lib/brand.js";
import { useMarketingTheme } from "@/components/marketing/theme-context";

type NavItem = { href: string; label: string; icon: LucideIcon };

const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/deals", label: "Deals", icon: BadgeDollarSign },
  { href: "/dashboard/finance", label: "Money", icon: Wallet },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/notes", label: "Notes", icon: StickyNote },
  { href: "/dashboard/tags", label: "Tags", icon: Tag },
  { href: "/dashboard/audit", label: "Audit log", icon: History },
];

const secondaryNav: NavItem[] = [
  { href: "/dashboard/keys", label: "API keys", icon: KeyRound },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`sb-item${active ? " sb-item--active" : ""}`}
    >
      <span className="sb-item__ic">
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className="sb-item__lbl">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { theme } = useMarketingTheme();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const workspaceName = user?.firstName
    ? user.firstName.toLowerCase()
    : (email.split("@")[0] ?? "workspace");

  // logo-mark.svg has a dark background (fits light theme); logo-mark-light.svg
  // has a light background (fits dark theme). The .sb__ws-mark CSS flips its own
  // background between themes too, so picking the matching SVG keeps the mark
  // legible without a visible frame around it.
  const markSrc =
    theme === "dark" ? "/brand/logo-mark-light.svg" : "/brand/logo-mark.svg";

  return (
    <aside className="sb">
      <div className="sb__ws">
        <div className="sb__ws-mark">
          <Image src={markSrc} width={20} height={20} alt="" />
        </div>
        <div className="sb__ws-meta">
          <div className="sb__ws-name">
            {BRAND.name} · {workspaceName}
          </div>
        </div>
        <span className="sb__ws-chev">▾</span>
      </div>

      <div className="sb__group">
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>

      <div className="sb__spacer" />

      <div className="sb__group">
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="sb-item" style={{ cursor: "default" }}>
          <span className="sb-item__ic">
            <UserButton
              appearance={{ elements: { avatarBox: "h-[15px] w-[15px]" } }}
            />
          </span>
          <span className="sb-item__lbl" title={email}>
            {email || "Account"}
          </span>
        </div>
      </div>
    </aside>
  );
}
