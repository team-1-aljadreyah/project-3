import { BellRing } from "lucide-react";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { askNotificationPermission, playChime, useNotificationPermission } from "@/shared/pwa";
import { useToast } from "@/shared/ui";
import { inviteLater, saveDevicePrefs, useDevicePrefs, useInvitedRecently } from "../device-prefs";
import { syncPush } from "../push-sync";

/**
 * After signing in, a small card above the page invites the person to turn on system notifications. The browser's
 * question comes only from the button (never on its own when a page opens). "Later" hides it for a few days; it never
 * shows once the browser has an answer (allowed or blocked: the notifications page explains how to unblock).
 */
export function AlertsInvite() {
  const { tr } = useFmt();
  const toast = useToast();
  const me = useUser().id;
  const permission = useNotificationPermission();
  const device = useDevicePrefs(me);
  const later = useInvitedRecently(me);
  // Not when the person switched notifications off on this device (the account menu).
  if (permission !== "default" || !device.on || !device.system || later) return null;

  const turnOn = async () => {
    const answer = await askNotificationPermission();
    if (answer === "granted") {
      saveDevicePrefs(me, { system: true });
      playChime("notification", true);
      toast(tr("فُعّلت التنبيهات على هذا الجهاز.", "Alerts are on for this device."));
      void syncPush(me, true);
    } else if (answer === "default") {
      inviteLater(me);
    }
  };

  return (
    <aside aria-label={tr("التنبيهات", "Alerts")} className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl border border-line bg-card p-3 shadow-card">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
        <BellRing size={18} />
      </span>
      <p className="min-w-0 flex-1 basis-56 text-sm">
        {tr("فعّل التنبيهات لتصلك الرسائل والإشعارات حتى والمنصة في الخلفية", "Turn on alerts to get messages and notifications even while the platform is in the background")}
      </p>
      <div className="flex shrink-0 items-center gap-1.5 max-sm:ms-[3.25rem]">
        <button type="button" onClick={() => inviteLater(me)} className="h-9 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-chip hover:text-text">
          {tr("لاحقاً", "Later")}
        </button>
        <button type="button" onClick={turnOn} className="h-9 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover">
          {tr("فعّل", "Turn on")}
        </button>
      </div>
    </aside>
  );
}
