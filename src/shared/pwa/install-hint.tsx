import { X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { BrandMark } from "@/shared/ui";
import { isPhone } from "./detect";
import { installApp, useInstallWay } from "./install";

const KEY = "p3.install-hint";

function seenBefore() {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, "done");
  } catch {}
}

const noop = () => () => {};

/**
 * Once, on a phone, after signing in: a small card at the bottom of the screen offering to install the platform on the home screen
 * (when this browser can). Not a pop-up: it covers nothing but its own corner and moves nothing. Closing it, or installing, is
 * remembered on this device, so it never comes back.
 */
export function InstallHint() {
  const { tr } = useFmt();
  const way = useInstallWay();
  const phone = useSyncExternalStore(noop, isPhone, () => false);
  const [done, setDone] = useState(seenBefore);
  if (!way || !phone || done) return null;

  const close = () => {
    markSeen();
    setDone(true);
  };

  return (
    // It floats at the bottom of the screen: the browser says it can install a moment after the page has drawn, and a
    // card arriving above the page then would push everything down (a layout shift). Only the card takes clicks.
    <aside
      aria-label={tr("تثبيت المنصة", "Install the platform")}
      className="menu-pop fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-[0_18px_44px_-14px_rgb(70_12_40/0.35)] dark:shadow-[0_18px_44px_-10px_rgb(0_0_0/0.7)] print:hidden"
    >
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-[#7c0e44]">
        <BrandMark on="accent" className="size-8" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{tr("ثبّت المنصة على شاشتك الرئيسية", "Add the platform to your home screen")}</span>
        <span className="text-xs text-muted">{tr("تفتح بضغطة، في نافذتها الخاصة.", "One tap away, in its own window.")}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          close();
          void installApp();
        }}
        className="h-9 shrink-0 rounded-xl bg-accent px-3.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
      >
        {tr("ثبّت", "Install")}
      </button>
      <button type="button" onClick={close} aria-label={tr("إخفاء", "Dismiss")} className="-ms-1 rounded-full p-1.5 text-muted hover:bg-chip hover:text-text">
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  );
}
