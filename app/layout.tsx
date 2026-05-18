import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
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

// Self-host mode: no Clerk env var → no <ClerkProvider> wrapping the tree.
// The Clerk SDK throws at module-eval time when it sees an unset publishable
// key, so we have to gate the provider, not just disable auth checks.
const CLERK_ENABLED = !!process.env.CLERK_SECRET_KEY;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const html = (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Analytics />
      </body>
    </html>
  );

  if (!CLERK_ENABLED) return html;

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#ff5c2b",
          colorBackground: "#ffffff",
          colorText: "#0a0a0b",
          colorTextSecondary: "#71717a",
          colorInputBackground: "#ffffff",
          colorInputText: "#0a0a0b",
          colorNeutral: "#71717a",
          borderRadius: "6px",
          fontFamily: "var(--font-geist-sans)",
        },
        elements: {
          card: "bg-card border border-border",
          formButtonPrimary:
            "bg-primary text-primary-foreground hover:bg-coral-600 active:bg-coral-700",
        },
      }}
    >
      {html}
    </ClerkProvider>
  );
}
