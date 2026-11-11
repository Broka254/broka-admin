import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/app/globals.css";
import { QueryProvider } from "@/components/system/query-provider";

// Self-hosted variable fonts: the previous CSS named Montserrat/Inter but the
// app never loaded either, so every surface silently fell back to system type.
const sans = localFont({
  src: [{ path: "../public/fonts/inter-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const display = localFont({
  src: [{ path: "../public/fonts/montserrat-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-display",
  display: "swap",
  fallback: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: { default: "BROKA Admin — Command Center", template: "%s · BROKA Admin" },
  description: "BROKA marketplace intelligence and operations command center.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{<QueryProvider>{children}</QueryProvider>}</body>
    </html>
  );
}
