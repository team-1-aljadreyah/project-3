import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

/** The front end's version (package.json), shown on the admin's system health page. */
const version = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;

// Two ways to build the site:
// - `npm run build` + `npm run start`: a Node server serves .next/ (Jenkins and the browser tests use this).
// - `npm run build:static` (or STATIC_EXPORT=true): plain files in out/, for a static host such as Cloudflare Pages.
//   The whole site runs in the browser (no server code), so nothing is lost. The pages with an id are built once and
//   public/_redirects sends every id to them (see shared/lib/route-param.ts). docs/deploy-cloudflare.md has the steps.
// The dev server (`npm run dev`) runs on port 3000; the browser tests serve the built site on 3100 (playwright.config.ts).
const staticExport = process.env.STATIC_EXPORT === "true" || process.env.npm_lifecycle_event === "build:static";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  // Don't tell visitors which framework serves the site.
  poweredByHeader: false,
  env: {
    // Always a definite "true" or "false", written into the code when it builds. When the setting is missing (a real
    // build with no .env), Next.js would leave it unknown, the build couldn't drop the demo branches, and the demo
    // accounts would reach the real site. `npm run check:no-demo` and the clean copy check prove it.
    NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK === "true" ? "true" : "false",
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
