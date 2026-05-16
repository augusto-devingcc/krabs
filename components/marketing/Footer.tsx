"use client";

import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand.js";
import { useMarketingTheme } from "./theme-context";

const FOOTER_COLS: Array<{
  head: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    head: "product",
    links: [
      { label: "MCP", href: "/#features" },
      { label: "CLI", href: "/#features" },
      { label: "HTTP API", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Status", href: "/status" },
    ],
  },
  {
    head: "docs",
    links: [
      { label: "Introduction", href: "/docs" },
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "Auth", href: "/docs/auth" },
      { label: "Contract", href: "/docs/contract" },
      { label: "Runs", href: "/docs/runs" },
      { label: "Webhooks", href: "/docs/webhooks" },
    ],
  },
  {
    head: "founder",
    links: [
      { label: "About", href: "/about" },
      { label: "Security", href: "/security" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
  {
    head: "resources",
    links: [
      { label: "Pricing", href: "/#pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "Contact", href: `mailto:${BRAND.email.support}` },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
];

export function MarketingFooter() {
  const { theme } = useMarketingTheme();
  const wordmark =
    theme === "dark" ? "/brand/logo-wordmark-dark.svg" : "/brand/logo-wordmark.svg";
  const year = new Date().getFullYear();

  return (
    <footer className="mk-ft">
      <div className="mk-ft__inner">
        <div className="mk-ft__brand">
          <Image src={wordmark} alt={BRAND.productName} width={100} height={20} />
          <p>{BRAND.headline}</p>
          <div className="mk-ft__status">
            <span className="mk-ft__pip" />
            <Link href="/status">all systems normal · status.{BRAND.domain}</Link>
          </div>
        </div>
        <div className="mk-ft__cols">
          {FOOTER_COLS.map((c) => (
            <div className="mk-ft__col" key={c.head}>
              <div className="mk-ft__col-head">{c.head}</div>
              {c.links.map((l) => (
                <Link key={l.label} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mk-ft__legal">
        <span>
          © {year} {BRAND.domain}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
          v1.0 · {BRAND.app}
        </span>
      </div>
    </footer>
  );
}
