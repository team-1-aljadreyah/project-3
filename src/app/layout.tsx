// The root layout: the one HTML page around every address (Next.js App Router). It runs on the server, so it only
// writes the page's frame: language, direction, the title, the font and styles, and the start-up script.
import "@fontsource-variable/readex-pro"; // the font (board D), served from our own files, Arabic and Latin
import "./styles.css";
import type { Metadata, Viewport } from "next";
import { BOOT_SCRIPT } from "@/shared/lib/boot";
import { BRAND } from "@/shared/lib/brand";
import { Providers } from "./providers";

// No `title` here on purpose: Next.js would write it into the page a moment after the page sets its own title
// (usePageTitle), and the tab would show only the platform's name. The <title> below is in the first HTML instead.
export const metadata: Metadata = {
  description: "منصة الشركة لإدارة المشاريع والمهام والفرق ومتابعة الإنجاز",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#170d12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Arabic and right to left by default. The script switches to the saved language and theme before the first paint,
    // so it changes <html> before React starts: suppressHydrationWarning tells React that is expected.
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <title>{BRAND.ar}</title>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
