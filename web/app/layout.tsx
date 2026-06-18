import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BRAND } from "@/lib/brand.js";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.productName, template: `%s — ${BRAND.productName}` },
  description: BRAND.description,
  metadataBase: new URL(`https://${BRAND.domain}`),
  icons: { icon: "/favicon.svg" },
};

// iOS Safari colors the status bar / browser chrome with `theme-color`.
// Without this, the OS chrome defaults to white and bleeds through the
// nav's translucent backdrop-filter blur in dark mode.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
