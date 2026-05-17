"use client";

import { useCallback, useEffect, useState } from "react";
import { MarketingThemeProvider } from "@/components/marketing/theme-context";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { CommandPalette } from "@/components/dashboard/CommandPalette";

// Client-only chrome wrapper: hosts the theme provider, the ⌘K command
// palette state, and the app shell (sidebar + topbar + content area).
// The dashboard layout is a server component (it awaits getDashboardContext),
// so all interactive shell concerns live here.
export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const open = useCallback(() => setPaletteOpen(true), []);
  const close = useCallback(() => setPaletteOpen(false), []);

  // Global ⌘K / Ctrl-K hotkey. Mirrors the designer's prototype.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MarketingThemeProvider>
      {/* Outermost shell — `h-screen` pins the dashboard to viewport height
          so its flex children (sidebar, main column) own their own scroll
          contexts. Without a fixed height parent, the inner `.app`/`.main`
          `overflow:hidden` rules don't have anything to clip against. */}
      <div className="app h-screen flex bg-background text-foreground">
        <Sidebar />
        <div className="main">
          <Topbar onOpenPalette={open} />
          {/* Page renders directly into `.main`'s flex column. Each route
              owns its scroll container (`.center`, `.rp`, `.st`, ...) so
              we don't double-stack overflow:auto contexts. */}
          {children}
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={close} />
    </MarketingThemeProvider>
  );
}
