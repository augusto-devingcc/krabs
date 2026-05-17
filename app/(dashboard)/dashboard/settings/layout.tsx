import { SettingsRail } from "@/components/dashboard/SettingsRail";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Settings surface uses the designer's `.st` shell — a 220px rail of
  // section links + a scrolling pane. Sub-routes (integrations/*, ...)
  // render inside `.st__pane` via this layout.
  return (
    <div className="st">
      <SettingsRail />
      <div className="st__pane">{children}</div>
    </div>
  );
}
