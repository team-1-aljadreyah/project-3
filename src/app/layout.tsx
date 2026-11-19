// The root layout: the one HTML page around every address (Next.js App Router). It runs on the server, so it only
// writes the page's frame: language, direction, the title, the font and styles, and the start-up script.
import "@fontsource-variable/readex-pro"; // the font (board D), served from our own files, Arabic and Latin
import "./styles.css";
import type { Metadata, Viewport } from "next";
import { BOOT_SCRIPT } from "@/shared/lib/boot";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "منصة المشاريع",
  description: "منصة الشركة لإدارة المشاريع والمهام والفرق ومتابعة الإنجاز",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#121418" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Arabic and right to left by default. The script switches to the saved language and theme before the first paint,
    // so it changes <html> before React starts: suppressHydrationWarning tells React that is expected.
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
