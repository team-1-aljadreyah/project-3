import { Download, Ellipsis, EllipsisVertical, Menu, MonitorDown, Plus, Share, SquarePlus } from "lucide-react";
import { useState } from "react";
import { BRAND } from "@/shared/lib/brand";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { BrandMark, Button, Dialog } from "@/shared/ui";
import { browserKind, installApp, useInstallWay, useIsInstalled, type BrowserKind } from "./install";

type Step = { ar: string; en: string; icon?: React.ReactNode };
type Guide = { name: { ar: string; en: string }; steps: Step[] };

const dots = <EllipsisVertical size={18} />;

/**
 * The steps for each browser, when it can't open its own install window right now. The buttons to press are drawn as
 * icons (a ⋮ written in Arabic text turns into a colon), and the browser's own menu names are quoted.
 */
const GUIDES: Record<BrowserKind, Guide> = {
  chrome: {
    name: { ar: "Chrome على الحاسوب", en: "Chrome on a computer" },
    steps: [
      { ar: "اضغط زر التثبيت في آخر شريط العنوان (شاشة عليها سهم).", en: "Press the install button at the end of the address bar (a screen with an arrow).", icon: <MonitorDown size={18} /> },
      { ar: "إن لم تجده: افتح قائمة Chrome (النقاط الثلاث أعلى النافذة).", en: "Not there? Open Chrome's menu (the three dots at the top of the window).", icon: dots },
      { ar: "اختر «الإرسال والحفظ والمشاركة» ثم «تثبيت الصفحة كتطبيق»، ثم «تثبيت».", en: 'Choose "Cast, save, and share", then "Install page as app", then "Install".' },
    ],
  },
  edge: {
    name: { ar: "Edge على الحاسوب", en: "Edge on a computer" },
    steps: [
      { ar: "اضغط زر التثبيت في شريط العنوان (مربعات وعلامة +).", en: "Press the install button in the address bar (squares with a +).", icon: <SquarePlus size={18} /> },
      { ar: "إن لم تجده: افتح قائمة Edge (النقاط الثلاث أعلى النافذة).", en: "Not there? Open Edge's menu (the three dots at the top of the window).", icon: <Ellipsis size={18} /> },
      { ar: "اختر «التطبيقات» ثم «تثبيت هذا الموقع كتطبيق»، ثم «تثبيت».", en: 'Choose "Apps", then "Install this site as an app", then "Install".' },
    ],
  },
  opera: {
    name: { ar: "Opera على الحاسوب", en: "Opera on a computer" },
    steps: [
      { ar: "اضغط زر التثبيت في آخر شريط العنوان.", en: "Press the install button at the end of the address bar.", icon: <MonitorDown size={18} /> },
      { ar: "ثم اختر «تثبيت».", en: 'Then choose "Install".' },
    ],
  },
  "safari-mac": {
    name: { ar: "Safari على Mac", en: "Safari on a Mac" },
    steps: [
      { ar: "اضغط زر المشاركة في أعلى النافذة، أو افتح قائمة «ملف».", en: 'Press the Share button at the top of the window, or open the "File" menu.', icon: <Share size={18} /> },
      { ar: "اختر «إضافة إلى Dock»، ثم «إضافة».", en: 'Choose "Add to Dock", then "Add".', icon: <Plus size={18} /> },
    ],
  },
  firefox: {
    name: { ar: "Firefox على الحاسوب", en: "Firefox on a computer" },
    steps: [
      { ar: "Firefox على الحاسوب لا يثبّت المواقع كتطبيقات.", en: "Firefox on a computer can't install sites as apps." },
      { ar: "افتح المنصة في Chrome أو Edge، ثم اضغط «ثبّت التطبيق» هناك.", en: 'Open the platform in Chrome or Edge, then press "Download the app" there.' },
    ],
  },
  "chrome-android": {
    name: { ar: "Chrome على Android", en: "Chrome on Android" },
    steps: [
      { ar: "افتح قائمة Chrome (النقاط الثلاث في الأعلى).", en: "Open Chrome's menu (the three dots at the top).", icon: dots },
      { ar: "اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».", en: 'Choose "Install app" or "Add to Home screen".', icon: <SquarePlus size={18} /> },
      { ar: "ثم «تثبيت».", en: 'Then "Install".' },
    ],
  },
  samsung: {
    name: { ar: "متصفح Samsung", en: "Samsung Internet" },
    steps: [
      { ar: "افتح القائمة (الخطوط الثلاثة في الأسفل).", en: "Open the menu (the three lines at the bottom).", icon: <Menu size={18} /> },
      { ar: "اختر «إضافة الصفحة إلى» ثم «الشاشة الرئيسية».", en: 'Choose "Add page to", then "Home screen".', icon: <Plus size={18} /> },
    ],
  },
  "firefox-android": {
    name: { ar: "Firefox على Android", en: "Firefox on Android" },
    steps: [
      { ar: "افتح قائمة Firefox (النقاط الثلاث).", en: "Open Firefox's menu (the three dots).", icon: dots },
      { ar: "اختر «تثبيت» أو «إضافة إلى الشاشة الرئيسية».", en: 'Choose "Install" or "Add to Home screen".', icon: <SquarePlus size={18} /> },
    ],
  },
  other: {
    name: { ar: "هذا المتصفح", en: "This browser" },
    steps: [{ ar: "افتح المنصة في Chrome أو Edge أو Safari، ثم اضغط «ثبّت التطبيق» هناك.", en: 'Open the platform in Chrome, Edge or Safari, then press "Download the app" there.' }],
  },
};

/**
 * "Download the app": always there (until the app is installed), so people find it before they sign in. It opens the
 * browser's own install window when the browser offers one, the iPhone/iPad how-to on those, and otherwise the steps for
 * the browser in use (Chrome, Edge, Opera, Safari, Firefox, Samsung Internet...).
 */
export function InstallButton({ className }: { className?: string }) {
  const { tr, num } = useFmt();
  const way = useInstallWay();
  const installed = useIsInstalled();
  const [help, setHelp] = useState<BrowserKind | null>(null);
  if (installed) return null;

  const press = () => {
    if (way) void installApp();
    else setHelp(browserKind(navigator.userAgent));
  };
  const guide = help ? GUIDES[help] : null;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={press} className={cn("gap-1.5", className)}>
        <Download size={15} aria-hidden="true" />
        {tr("ثبّت التطبيق", "Download the app")}
      </Button>
      <Dialog
        open={!!guide}
        onClose={() => setHelp(null)}
        title={tr("ثبّت المنصة على جهازك", "Install the platform on your device")}
        footer={<Button onClick={() => setHelp(null)}>{tr("حسناً", "Got it")}</Button>}
      >
        {guide && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-xl bg-accent-soft/60 p-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#7c0e44]">
                <BrandMark on="accent" className="size-9" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{tr(BRAND.ar, BRAND.en)}</span>
                <span className="text-[13px] text-muted">{tr("تفتح من جهازك في نافذتها الخاصة، مثل أي تطبيق.", "Opens from your device in its own window, like any app.")}</span>
              </span>
            </div>
            <p className="text-sm">
              {tr("أنت تستخدم ", "You are using ")}
              <b>{tr(guide.name.ar, guide.name.en)}</b>
              {tr(":", ":")}
            </p>
            <ol className="flex flex-col gap-3.5" aria-label={tr("الخطوات", "Steps")}>
              {guide.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span aria-hidden="true" className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                    {num(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-relaxed">{tr(s.ar, s.en)}</span>
                  {s.icon && (
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card-2 text-text shadow-card">
                      {s.icon}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Dialog>
    </>
  );
}
