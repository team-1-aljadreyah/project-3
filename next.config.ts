import type { NextConfig } from "next";

// Next.js builds the site into .next/ and serves it with `npm run start` (a Node server).
// The dev server (`npm run dev`) runs on port 3000; the browser tests serve the built site on 3100 (playwright.config.ts).
const nextConfig: NextConfig = {
  // Don't tell visitors which framework serves the site.
  poweredByHeader: false,
  env: {
    // Always a definite "true" or "false", written into the code when it builds. When the setting is missing (a real
    // build with no .env), Next.js would leave it unknown, the build couldn't drop the demo branches, and the demo
    // accounts would reach the real site. `npm run check:no-demo` and the clean copy check prove it.
    NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK === "true" ? "true" : "false",
  },
};

export default nextConfig;
