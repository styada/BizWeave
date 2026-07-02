import type { Metadata } from "next";
import "./globals.css";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400"],
});

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
    <html lang="en" className={cn("h-full", "font-sans", dmSans.variable, instrumentSerif.variable)}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
