// For the plain-files build (Cloudflare Pages): this address is built once, for the id "_", and the host serves that
// one page for every id (public/_redirects). The page reads the real id from the address (shared/lib/route-param.ts).
import { shellParams } from "@/shared/lib/route-shell";

export const generateStaticParams = () => shellParams("id");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
