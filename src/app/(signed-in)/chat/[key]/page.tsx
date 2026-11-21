// The chat itself is drawn by ../layout.tsx (see there). This file only makes the address exist.
import { shellParams } from "@/shared/lib/route-shell";

// For the plain-files build (Cloudflare Pages): built once, for "_"; the host serves it for every chat (public/_redirects).
export const generateStaticParams = () => shellParams("key");

export default function ChatRoute() {
  return null;
}
