import type { ReactNode } from "react";

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`dc-callout dc-callout--${tone}`}>
      <div className="dc-callout__head">{title}</div>
      <div className="dc-callout__body">{children}</div>
    </div>
  );
}
