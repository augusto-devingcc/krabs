"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Wallet,
  Mail,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };

const items: Item[] = [
  { href: "/dashboard/settings", label: "Account", icon: User },
  { href: "/dashboard/settings/integrations/stripe", label: "Stripe", icon: Wallet },
  { href: "/dashboard/settings/integrations/resend", label: "Resend", icon: Mail },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/settings") return pathname === "/dashboard/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsRail() {
  const pathname = usePathname();
  return (
    <aside className="st__rail">
      <div className="st__rail-h">Settings</div>
      <div className="st__rail-group">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`st__rail-item${active ? " st__rail-item--active" : ""}`}
            >
              <span className="st__rail-ic">
                <Icon size={14} strokeWidth={1.75} />
              </span>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="st__rail-foot">
        <span>krabs · settings</span>
      </div>
    </aside>
  );
}
