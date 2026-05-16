import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { BRAND } from "@/lib/brand.js";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s — ${BRAND.name}` },
  description: BRAND.description,
  metadataBase: new URL(`https://${BRAND.domain}`),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#fafafa",
          colorBackground: "#0a0a0a",
          colorText: "#fafafa",
          colorTextSecondary: "#a3a3a3",
          colorInputBackground: "#111111",
          colorInputText: "#fafafa",
          colorNeutral: "#a3a3a3",
          borderRadius: "5px",
          fontFamily: "var(--font-geist-sans)",
        },
        elements: {
          card: "bg-[var(--color-surface)] border border-[var(--color-border)]",
          formButtonPrimary:
            "bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)]",
        },
      }}
    >
      <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
