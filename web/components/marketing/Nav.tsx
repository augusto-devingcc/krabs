"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand.js";
import { useMarketingTheme } from "./theme-context";

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "Product", href: "/#features" },
  { label: "Docs", href: "/docs" },
  { label: "Self-host", href: "/self-host" },
  { label: "Changelog", href: "/changelog" },
];

export function MarketingNav() {
  const { theme, toggleTheme } = useMarketingTheme();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const wordmark =
    theme === "dark" ? "/brand/logo-text-dark.svg" : "/brand/logo-text.svg";

  // Close the menu whenever the URL changes — clicking a link should dismiss.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <nav className="mk-nav" data-menu-open={menuOpen ? "true" : "false"}>
      <div className="mk-nav__inner">
        <Link href="/" className="mk-nav__brand" aria-label={BRAND.productName}>
          <Image
            src={wordmark}
            alt={BRAND.productName}
            width={92}
            height={22}
            priority
          />
        </Link>
        <div className="mk-nav__links">
          {NAV_LINKS.map((l) => (
            <Link key={l.label} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
        <Link
          href={BRAND.repo}
          className="mk-btn mk-btn--primary mk-btn--sm mk-nav__cta-mobile"
        >
          GitHub <span style={{ opacity: 0.8, marginLeft: 2 }}>→</span>
        </Link>
        <div className="mk-nav__right">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link href="/docs/quickstart" className="mk-nav__signin">
            Quickstart
          </Link>
          <Link href={BRAND.repo} className="mk-btn mk-btn--primary mk-btn--sm">
            GitHub <span style={{ opacity: 0.8, marginLeft: 2 }}>→</span>
          </Link>
          <button
            type="button"
            className="mk-nav__hamburger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mk-nav__mobile" role="dialog" aria-label="Navigation">
          {NAV_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="mk-nav__mobile-link">
              {l.label}
            </Link>
          ))}
          <div className="mk-nav__mobile-sep" />
          <Link href="/docs/quickstart" className="mk-nav__mobile-link">
            Quickstart
          </Link>
          <Link
            href={BRAND.repo}
            className="mk-btn mk-btn--primary mk-btn--lg mk-nav__mobile-cta"
          >
            GitHub <span style={{ opacity: 0.8, marginLeft: 2 }}>→</span>
          </Link>
          <button
            type="button"
            className="mk-nav__mobile-theme"
            onClick={toggleTheme}
          >
            <span>Theme</span>
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </div>
      )}
    </nav>
  );
}

function HamburgerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const isDark = theme === "dark";
  return (
    <button
      className="mk-nav__theme"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light" : "Switch to dark"}
      title={isDark ? "Light mode" : "Dark mode"}
      type="button"
    >
      {isDark ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
