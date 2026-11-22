// The web app manifest (/manifest.webmanifest): what a phone or tablet needs to install the site as an app (its name,
// icons, colours, and that it opens in its own window). Next.js links it from every page. The icons are made from the
// logo by scripts/make-icons.mjs; the service worker is public/sw.js (docs/deploy-cloudflare.md).
import type { MetadataRoute } from "next";
import { BRAND } from "@/shared/lib/brand";

// Written once when the site is built (also for the plain-files build).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.ar,
    short_name: BRAND.ar,
    description: "منصة الشركة لإدارة المشاريع والمهام والفرق ومتابعة الإنجاز · The company's platform for projects, tasks and teams",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // The page's off-white while the app opens and on the window's top bar, so nothing changes colour once the page is
    // there (the page then sets light or dark itself: theme-color in app/layout.tsx).
    background_color: "#f9f7f4",
    theme_color: "#f9f7f4",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
