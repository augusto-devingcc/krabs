import { MarketingThemeProvider } from "@/components/marketing/theme-context";
import { DocsTopNav } from "@/components/docs/DocsTopNav";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingThemeProvider>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <DocsTopNav />
        <div className="docs-shell">
          <DocsSidebar />
          {children}
        </div>
      </div>
    </MarketingThemeProvider>
  );
}
