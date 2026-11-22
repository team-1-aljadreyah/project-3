import { Bell, BellOff } from "lucide-react";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { askNotificationPermission, notificationPermission } from "@/shared/pwa";
import { MenuSwitch } from "@/shared/shell";
import { saveDevicePrefs, useDevicePrefs } from "../device-prefs";

/**
 * "Notifications: on / off" in the account menu, for everyone: one switch for the alerts on this device (sound and
 * the system's notifications). Off keeps the bell's list as it is, only quiet. Turning it on asks the browser for its
 * permission when it hasn't been asked yet. The finer choices are on the notifications page.
 */
export function AlertsSwitch() {
  const { tr } = useFmt();
  const user = useUser();
  const prefs = useDevicePrefs(user.id);
  const turn = (on: boolean) => {
    saveDevicePrefs(user.id, on ? { on, system: true } : { on });
    // A press is the one moment a browser lets a site ask.
    if (on && notificationPermission() === "default") void askNotificationPermission();
  };
  return (
    <MenuSwitch
      icon={prefs.on ? <Bell size={14} aria-hidden="true" /> : <BellOff size={14} aria-hidden="true" />}
      label={tr("التنبيهات", "Notifications")}
      options={[
        { key: "on", on: prefs.on, label: tr("تشغيل", "On"), onPick: () => turn(true) },
        { key: "off", on: !prefs.on, label: tr("إيقاف", "Off"), onPick: () => turn(false) },
      ]}
    />
  );
}
