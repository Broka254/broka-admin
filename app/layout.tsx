import type { Metadata } from "next";

import "@/app/globals.css";
import { QueryProvider } from "@/components/system/query-provider";

export const metadata: Metadata = {
  title: "BROKA Admin — Control Center",
  description: "BROKA internal marketplace operations control center.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
