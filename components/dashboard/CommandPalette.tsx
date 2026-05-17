"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BadgeDollarSign,
  Wallet,
  CheckSquare,
  StickyNote,
  Tag,
  History,
  KeyRound,
  CreditCard,
  Settings,
  Sun,
  Moon,
  Search,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useMarketingTheme } from "@/components/marketing/theme-context";

type Item = {
  id: string;
  label: string;
  sub?: string;
  group: "navigate" | "actions";
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

// Highlight matching characters inside the label using the cp-mark span.
function highlight(label: string, q: string) {
  if (!q) return label;
  const i = label.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return label;
  return (
    <>
      {label.slice(0, i)}
      <span className="cp-mark">{label.slice(i, i + q.length)}</span>
      {label.slice(i + q.length)}
    </>
  );
}

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const { theme, toggleTheme } = useMarketingTheme();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Static command list — navigation + actions. Stays in sync with sidebar.
  const items: Item[] = useMemo(
    () => [
      // Navigate
      { id: "nav-overview",  label: "Overview",    sub: "/dashboard",            group: "navigate", icon: LayoutDashboard, run: () => router.push("/dashboard") },
      { id: "nav-contacts",  label: "Contacts",    sub: "/dashboard/contacts",   group: "navigate", icon: Users,           run: () => router.push("/dashboard/contacts") },
      { id: "nav-deals",     label: "Deals",       sub: "/dashboard/deals",      group: "navigate", icon: BadgeDollarSign, run: () => router.push("/dashboard/deals") },
      { id: "nav-money",     label: "Money",       sub: "/dashboard/finance",    group: "navigate", icon: Wallet,          run: () => router.push("/dashboard/finance") },
      { id: "nav-tasks",     label: "Tasks",       sub: "/dashboard/tasks",      group: "navigate", icon: CheckSquare,     run: () => router.push("/dashboard/tasks") },
      { id: "nav-notes",     label: "Notes",       sub: "/dashboard/notes",      group: "navigate", icon: StickyNote,      run: () => router.push("/dashboard/notes") },
      { id: "nav-tags",      label: "Tags",        sub: "/dashboard/tags",       group: "navigate", icon: Tag,             run: () => router.push("/dashboard/tags") },
      { id: "nav-audit",     label: "Audit log",   sub: "/dashboard/audit",      group: "navigate", icon: History,         keywords: "runs activity log", run: () => router.push("/dashboard/audit") },
      { id: "nav-keys",      label: "API keys",    sub: "/dashboard/keys",       group: "navigate", icon: KeyRound,        keywords: "agents tokens",     run: () => router.push("/dashboard/keys") },
      { id: "nav-billing",   label: "Billing",     sub: "/dashboard/billing",    group: "navigate", icon: CreditCard,      run: () => router.push("/dashboard/billing") },
      { id: "nav-settings",  label: "Settings",    sub: "/dashboard/settings",   group: "navigate", icon: Settings,        run: () => router.push("/dashboard/settings") },
      // Actions
      {
        id: "action-theme",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        sub: "appearance",
        group: "actions",
        icon: theme === "dark" ? Sun : Moon,
        keywords: "theme dark light toggle appearance",
        run: () => toggleTheme(),
      },
    ],
    [router, theme, toggleTheme],
  );

  // Fuzzy-ish filter: case-insensitive substring match on label + keywords + sub.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.label} ${it.keywords ?? ""} ${it.sub ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  // Group filtered items preserving the original order within each group.
  const groups = useMemo(() => {
    const out: { name: string; key: Item["group"]; items: Item[] }[] = [];
    const byGroup: Record<Item["group"], Item[]> = { navigate: [], actions: [] };
    filtered.forEach((it) => byGroup[it.group].push(it));
    if (byGroup.navigate.length) out.push({ name: "Navigate", key: "navigate", items: byGroup.navigate });
    if (byGroup.actions.length) out.push({ name: "Actions", key: "actions", items: byGroup.actions });
    return out;
  }, [filtered]);

  // Flatten back to a single ordered list for keyboard nav.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Reset state on every open. Focus input on next tick so the animation
  // doesn't fight with autofocus.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setClosing(false);
      // Defer focus so the panel's enter animation can mount first.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep activeIdx in-bounds whenever the filtered list shrinks.
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1));
  }, [flat.length, activeIdx]);

  const requestClose = useCallback(() => {
    setClosing(true);
    // Mirror the panel-out CSS animation duration (140ms).
    setTimeout(onClose, 150);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (flat.length ? (i + 1) % flat.length : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = flat[activeIdx];
        if (item) {
          item.run();
          requestClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, activeIdx, requestClose]);

  if (!open) return null;

  return (
    <div className={`cp-root${closing ? " cp-root--closing" : ""}`}>
      <div className="cp-backdrop" onClick={requestClose} aria-hidden />
      <div className="cp-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cp-search">
          <Search size={16} aria-hidden />
          <input
            ref={inputRef}
            className="cp-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            placeholder="Search or jump to…"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="cp-search-kbd">
            <span className="k-kbd">esc</span>
          </span>
        </div>

        {flat.length === 0 ? (
          <div className="cp-empty">
            <div className="cp-empty-l">
              No matches for <span className="cp-empty-q">&quot;{query}&quot;</span>
            </div>
            <div className="cp-empty-s">Try a different search term.</div>
          </div>
        ) : (
          <div className="cp-list">
            {groups.map((group) => (
              <div key={group.key} className="cp-group">
                <div className="cp-group-h">{group.name}</div>
                {group.items.map((it) => {
                  const overallIdx = flat.findIndex((f) => f.id === it.id);
                  const active = overallIdx === activeIdx;
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className={`cp-item${active ? " cp-item--active" : ""}`}
                      onMouseEnter={() => setActiveIdx(overallIdx)}
                      onClick={() => {
                        it.run();
                        requestClose();
                      }}
                    >
                      <span className="cp-item-ic">
                        <Icon size={14} strokeWidth={1.5} />
                      </span>
                      <span className="cp-item-l">
                        <span>{highlight(it.label, query)}</span>
                        {it.sub && <span className="cp-item-sub">{it.sub}</span>}
                      </span>
                      <span className="cp-item-go">
                        <ArrowRight size={13} aria-hidden />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="cp-foot">
          <span className="cp-foot-hint"><span className="k-kbd">↑</span><span className="k-kbd">↓</span> navigate</span>
          <span className="cp-foot-hint"><span className="k-kbd">↵</span> open</span>
          <span className="cp-foot-hint"><span className="k-kbd">esc</span> close</span>
          <span className="cp-foot-spacer" />
          <span className="cp-foot-brand">krabs<span>.dev</span></span>
        </div>
      </div>
    </div>
  );
}
