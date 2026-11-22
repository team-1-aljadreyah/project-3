import { Download } from "lucide-react";
import { useFmt } from "@/shared/lib/i18n";
import { installApp, useInstallWay } from "./install";

/**
 * "Install the app" in the account menu: only when this browser can install it now (Chrome's offer, or an iPhone/iPad),
 * never once it is installed or opened as the app. `onPick` closes the menu.
 */
export function InstallMenuItem({ className, iconClassName, onPick }: { className: string; iconClassName: string; onPick: () => void }) {
  const { tr } = useFmt();
  const way = useInstallWay();
  if (!way) return null;
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={className}
      onClick={() => {
        onPick();
        void installApp();
      }}
    >
      <span className={iconClassName}>
        <Download size={16} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {tr("ثبّت التطبيق", "Install the app")}
        <span className="text-xs text-muted">{tr("على شاشتك الرئيسية، بنافذته الخاصة", "On your home screen, in its own window")}</span>
      </span>
    </button>
  );
}
