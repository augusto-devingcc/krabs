"use client";

import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand.js";
import { useMarketingTheme } from "@/components/marketing/theme-context";

export function DocsTopNav() {
  const { theme, toggleTheme } = useMarketingTheme();
  const mark = theme === "dark" ? "/brand/logo-mark-light.svg" : "/brand/logo-mark.svg";
  const isDark = theme === "dark";

  return (
    <nav className="dn">
      <div className="dn__inner">
        <Link href="/" className="dn__brand" aria-label={BRAND.productName}>
          <Image src={mark} alt={BRAND.productName} width={20} height={20} />
          <span>{BRAND.productName}</span>
          <span className="dn__brand-sep">/</span>
          <span className="dn__brand-area">docs</span>
        </Link>
        <div className="dn__tabs">
          <Link href="/docs" className="on">
            Guide
          </Link>
          <Link href="/docs/contract">API</Link>
          <Link href="/changelog">Changelog</Link>
        </div>
        <div className="dn__right">
          <button className="dn__search" type="button" disabled aria-label="Search (coming soon)">
            <span>Search docs…</span>
            <span className="dn__kbd">⌘K</span>
          </button>
          <button
            className="dn__theme"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light" : "Switch to dark"}
            title={isDark ? "Light mode" : "Dark mode"}
            type="button"
          >
            {isDark ? (
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="square" strokeLinejoin="miter" aria-hidden
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
              </svg>
            ) : (
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="square" strokeLinejoin="miter" aria-hidden
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <span className="dn__version">v0.4.3</span>
        </div>
      </div>
    </nav>
  );
}
