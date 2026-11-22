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
// The installed app (src/app/manifest.ts): iPhone and iPad read these tags instead of the manifest: open in its own
// window, its name under the icon, the icon itself, and a plain status bar above the page (the page starts below it).
export const metadata: Metadata = {
  description: "منصة الشركة لإدارة المشاريع والمهام والفرق ومتابعة الإنجاز",
  applicationName: BRAND.ar,
  appleWebApp: { capable: true, title: BRAND.ar, statusBarStyle: "default" },
  icons: { apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
  other: { "apple-mobile-web-app-capable": "yes" },
};

// "cover": the page may draw under the notch and the home bar; the frame keeps its content inside the safe area
// (env(safe-area-inset-*) in app/styles.css and the top bar).
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f7f4" },
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
