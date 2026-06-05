import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bizweave — Your business, woven online while you sleep",
    template: "%s | Bizweave",
  },
  description:
    "AI agents that build, run, and market your web business. Connect inventory, bring your own LLM keys, and let Safeguard review everything before it goes live.",
  keywords: [
    "AI business automation",
    "BYOK LLM",
    "existing business website",
    "AI agents",
    "retail website builder",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
