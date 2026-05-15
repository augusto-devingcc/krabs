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
          colorPrimary: "#4ade80",
          colorBackground: "#0a0a0a",
          colorText: "#f5f5f4",
          colorTextSecondary: "#a1a1aa",
          colorInputBackground: "#141414",
          colorInputText: "#f5f5f4",
          colorNeutral: "#a1a1aa",
          borderRadius: "6px",
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
