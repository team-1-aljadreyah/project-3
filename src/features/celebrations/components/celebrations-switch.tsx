import { PartyPopper } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { MenuSwitch } from "@/shared/shell";

// Celebrations on this device: on unless turned off (some people prefer a quiet screen). Kept in this browser only.
// Turned off, nothing is shown, and the team celebrations wait (they show when turned on again, within their 7 days).
const KEY = "p3.celebrations";
const EVENT = "p3-celebrations";

function read() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Are celebrations shown on this device? */
export function useCelebrationsOn() {
  return useSyncExternalStore(subscribe, read, () => false);
}

function turn(on: boolean) {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** "Celebrations: on / off" in the account menu, for everyone. */
export function CelebrationsSwitch() {
  const { tr } = useFmt();
  const on = useCelebrationsOn();
  return (
    <MenuSwitch
      icon={<PartyPopper size={14} aria-hidden="true" />}
      label={tr("الاحتفالات", "Celebrations")}
      options={[
        { key: "on", on, label: tr("تشغيل", "On"), onPick: () => turn(true) },
        { key: "off", on: !on, label: tr("إيقاف", "Off"), onPick: () => turn(false) },
      ]}
    />
  );
}
