import Link from "next/link";
import { BRAND } from "@/shared/lib/brand";
import { useFmt } from "@/shared/lib/i18n";
import { BrandMark } from "@/shared/ui";

/** The logo (the board, «لوحة») and the platform's name. Links to the home page. */
export function Logo() {
  const { tr } = useFmt();
  return (
    // No prefetch: on the sign-in page it downloaded the whole signed-in app while the page was still loading (the page
    // does it itself when the person starts to sign in), and inside the app the home page is already there.
    <Link href="/" prefetch={false} className="flex items-center gap-2.5 rounded-lg ps-1">
      <BrandMark className="size-[34px]" />
      <span className="text-[15px] font-semibold whitespace-nowrap">{tr(BRAND.ar, BRAND.en)}</span>
    </Link>
  );
}
