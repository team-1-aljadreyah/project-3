"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { useFmt } from "@/lib/i18n";

/** The logo square and the platform's name. Links to the home page. */
export function Logo() {
  const { tr } = useFmt();
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg ps-1">
      <span aria-hidden="true" className="flex size-[34px] items-center justify-center rounded-[9px] bg-accent font-bold text-on-accent">
        {BRAND.mark}
      </span>
      <span className="text-[15px] font-semibold whitespace-nowrap">{tr(BRAND.ar, BRAND.en)}</span>
    </Link>
  );
}
