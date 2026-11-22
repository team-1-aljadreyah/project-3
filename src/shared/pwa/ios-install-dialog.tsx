import { Plus, Share, SquarePlus } from "lucide-react";
import { BRAND } from "@/shared/lib/brand";
import { useFmt } from "@/shared/lib/i18n";
import { BrandMark, Button, Dialog } from "@/shared/ui";
import { closeIosHelp, useIosHelpOpen } from "./install";

/** Where the Share button is: at the bottom in Safari on an iPhone, at the top on an iPad and in the other browsers. */
function shareAtBottom() {
  const ua = navigator.userAgent;
  return /iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** One step: its number, what to press (drawn like the iPhone's own button), and a short line under it. */
function Step({ n, icon, title, hint }: { n: number; icon: React.ReactNode; title: string; hint: string }) {
  const { num } = useFmt();
  return (
    <li className="flex items-start gap-3.5">
      <span aria-hidden="true" className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
        {num(n)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-[13px] text-muted">{hint}</span>
      </span>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-card-2 text-[#0a84ff] shadow-card dark:text-[#4ea2ff]">
        {icon}
      </span>
    </li>
  );
}

/**
 * iPhone and iPad never offer to install a site: the person adds it to the home screen from the Share menu. This short
 * how-to opens from the account menu's "Install the app" and from the hint on phones.
 */
export function IosInstallDialog() {
  const { tr } = useFmt();
  const open = useIosHelpOpen();
  if (!open) return null;
  const bottom = shareAtBottom();

  return (
    <Dialog
      open={open}
      onClose={closeIosHelp}
      title={tr("ثبّت المنصة على جهازك", "Install the platform on your device")}
      footer={<Button onClick={closeIosHelp}>{tr("حسناً", "Got it")}</Button>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl bg-accent-soft/60 p-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#7c0e44] shadow-[0_8px_18px_-10px_rgb(124_14_68/0.7)]">
            <BrandMark on="accent" className="size-9" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{tr(BRAND.ar, BRAND.en)}</span>
            <span className="text-[13px] text-muted">{tr("تفتح من شاشتك الرئيسية في نافذتها الخاصة، مثل أي تطبيق.", "Opens from your home screen in its own window, like any app.")}</span>
          </span>
        </div>
        <ol className="flex flex-col gap-4" aria-label={tr("الخطوات", "Steps")}>
          <Step
            n={1}
            icon={<Share size={19} />}
            title={tr("اضغط زر المشاركة", "Tap the Share button")}
            hint={
              bottom
                ? tr("في الشريط أسفل الشاشة، أو داخل زر «⋯» في الإصدارات الأحدث.", "In the bar at the bottom of the screen, or inside the “⋯” button on newer versions.")
                : tr("في أعلى الشاشة، بجانب العنوان.", "At the top of the screen, next to the address.")
            }
          />
          <Step
            n={2}
            icon={<SquarePlus size={19} />}
            title={tr("اختر «إضافة إلى الشاشة الرئيسية»", "Choose “Add to Home Screen”")}
            hint={tr("مرّر القائمة إلى الأسفل إن لم تجده.", "Scroll the menu down if you don't see it.")}
          />
          <Step
            n={3}
            icon={<Plus size={19} />}
            title={tr("اضغط «إضافة»", "Tap “Add”")}
            hint={tr("تظهر أيقونة المنصة على شاشتك الرئيسية.", "The platform's icon appears on your home screen.")}
          />
        </ol>
      </div>
    </Dialog>
  );
}
