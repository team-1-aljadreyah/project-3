import type { NextConfig } from "next";

// A normal Next.js server build for now (`npm run build` + `npm start`).
// Hosting is not decided yet; if it becomes static files (like Project 2 on Cloudflare Pages), add `output: "export"` here.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      // Tailwind CSS 4 runs inside Turbopack (no postcss.config file needed).
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
