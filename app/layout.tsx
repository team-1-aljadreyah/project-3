import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { BRAND } from "@/lib/brand";
import { bootScript } from "@/lib/boot";
import { LangSync } from "@/lib/i18n";
import "./globals.css";

// One font for Arabic and English (the approved design D). Variable, so every weight is one file.
const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["arabic", "latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: BRAND.ar, template: `%s · ${BRAND.ar}` },
  description: "منصة الشركة لإدارة المشاريع والمهام والفرق ومتابعة الإنجاز",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#121418" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Arabic and right-to-left by default; the boot script switches to the saved language and theme
    // before the first paint, so nothing flashes.
    <html lang="ar" dir="rtl" className={readex.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <LangSync />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
