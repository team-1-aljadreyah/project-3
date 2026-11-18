import { useEffect } from "react";
import { BRAND } from "./brand";
import { useFmt } from "./i18n";

/** Sets the browser tab's title: "Page · Platform name", or only the platform's name when there is no page title. */
export function usePageTitle(title?: string) {
  const { tr } = useFmt();
  const brand = tr(BRAND.ar, BRAND.en);
  useEffect(() => {
    document.title = title ? `${title} · ${brand}` : brand;
  }, [title, brand]);
}
