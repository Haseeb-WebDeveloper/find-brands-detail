import type { Metadata } from "next";
import { designInter } from "@/design/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Brand Enrich", template: "%s · Brand Enrich" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={designInter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
