import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Search, SquareArrowUpRight } from "lucide-react";
import { SidebarNav } from "@/components/docs/sidebar-nav";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-sm font-medium tracking-tight"
          >
            <BookOpen size={16} aria-hidden />
            <span>socrm</span>
            <span className="text-muted-foreground">/ docs</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="https://github.com"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <SquareArrowUpRight size={16} aria-hidden />
              GitHub
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-foreground hover:bg-accent"
            >
              Sign in <span aria-hidden>→</span>
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-10 px-6">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[260px] shrink-0 self-start overflow-y-auto py-8 pr-2 lg:block">
          <div className="mb-6 px-2">
            <Link
              href="/"
              className="flex items-center gap-2 font-mono text-base font-medium"
            >
              <BookOpen size={18} aria-hidden />
              <span>socrm</span>
            </Link>
          </div>
          <div className="mb-6 px-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground">
              <Search size={14} aria-hidden />
              <span className="flex-1">Search docs</span>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          </div>
          <SidebarNav />
        </aside>

        <main className="min-w-0 flex-1 py-10">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
