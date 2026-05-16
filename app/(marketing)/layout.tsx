import { MarketingThemeProvider } from "@/components/marketing/theme-context";
import { MarketingNav } from "@/components/marketing/Nav";
import { MarketingFooter } from "@/components/marketing/Footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingThemeProvider>
      <MarketingNav />
      {children}
      <MarketingFooter />
    </MarketingThemeProvider>
  );
}
