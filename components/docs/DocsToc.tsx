import Link from "next/link";

export type TocItem = { id: string; label: string };

export function DocsToc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav className="dt" aria-label="On this page">
      <div className="dt__head">On this page</div>
      {items.map((item) => (
        <Link key={item.id} href={`#${item.id}`} className="dt__item">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
