import type { Metadata } from "next";
import { Suspense } from "react";
import { designInter } from "@/design/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Brand Enrich", template: "%s · Brand Enrich" },
  robots: { index: false, follow: false },
};

/**
 * Every page streams inside one Suspense boundary (contractor-sites' root layout does the same).
 * With `cacheComponents`, a page that reads the session or the URL must sit inside a boundary; this
 * one lets the document shell prerender and the page fill in.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={designInter.variable} suppressHydrationWarning>
      <body>
        <Suspense>{children}</Suspense>
      </body>
    </html>
  );
}
